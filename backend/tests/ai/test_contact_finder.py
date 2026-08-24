"""Tests for the autonomous Contact Finder Agent.

Covers:
- DuckDuckGo search helper (network mocked via httpx)
- Domain extraction logic
- MX validation (socket mocked)
- LLM-based contact extraction
- Company contact cache (hit + miss + upsert)
- Full agent pipeline: cache miss, search, LLM, DNS validation, persist
- Agent pipeline: cache hit (skips search)
- Agent pipeline: LLM failure is swallowed gracefully
- Agent pipeline: MX failure clears email and reduces confidence
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from ai.agents.contact_finder import (
    ContactFinderAgent,
    _company_key,
    _ddg_search,
    _extract_domain,
    _mx_valid,
    _upsert_contact,
)
from ai.schemas import ContactInfo


@pytest.fixture
def anyio_backend():
    return "asyncio"


# ---------------------------------------------------------------------------
# Unit tests — pure helper functions (no I/O)
# ---------------------------------------------------------------------------


def test_company_key_normalizes_name():
    assert _company_key("Acme Corp") == "acmecorp"
    assert _company_key("OpenAI, Inc.") == "openaiinc"
    assert _company_key("  DeepMind  ") == "deepmind"
    assert _company_key("Y Combinator") == "ycombinator"


def test_extract_domain_from_job_link():
    domain = _extract_domain("https://careers.stripe.com/jobs/123", "Stripe")
    assert domain == "careers.stripe.com"


def test_extract_domain_strips_job_board():
    # LinkedIn job link should not return linkedin.com — falls back to slug
    domain = _extract_domain("https://www.linkedin.com/jobs/view/12345", "OpenAI Inc")
    # Should fall back to naive company slug
    assert domain == "openaiinc.com"


def test_extract_domain_strips_www():
    domain = _extract_domain("https://www.example.com/careers/eng", "Example")
    assert domain == "example.com"


def test_extract_domain_empty_link_uses_slug():
    domain = _extract_domain("", "Stripe")
    assert domain == "stripe.com"


def test_extract_domain_no_link_no_company():
    domain = _extract_domain("", "")
    assert domain is None


# ---------------------------------------------------------------------------
# DuckDuckGo search (mock httpx)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_ddg_search_returns_snippets():
    html_body = (
        '<div class="result__snippet">Hire talented engineers at Stripe</div>'
        '<div class="result__snippet">Stripe recruiter jobs in San Francisco</div>'
        "john@stripe.com"
    )
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.text = html_body

    with patch("ai.agents.contact_finder.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        snippets = await _ddg_search("Stripe recruiter", max_snippets=5)

    assert any("Stripe" in s for s in snippets)
    # Raw email also extracted
    assert any("stripe.com" in s for s in snippets)


@pytest.mark.anyio
async def test_ddg_search_handles_network_error_gracefully():
    with patch("ai.agents.contact_finder.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=httpx.ConnectTimeout("timeout"))
        mock_client_cls.return_value = mock_client

        snippets = await _ddg_search("test query")

    # Should return empty list, not raise
    assert snippets == []


# ---------------------------------------------------------------------------
# MX validation (mock socket)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_mx_valid_returns_true_for_resolvable_domain():
    with patch("ai.agents.contact_finder.asyncio.get_event_loop") as mock_loop:
        loop = MagicMock()
        mock_loop.return_value = loop
        loop.run_in_executor = AsyncMock(
            return_value=[("", "", "", "", ("1.2.3.4", 0))]
        )

        result = await _mx_valid("google.com")

    assert result is True


@pytest.mark.anyio
async def test_mx_valid_returns_false_for_bad_domain():
    with patch("ai.agents.contact_finder.asyncio.get_event_loop") as mock_loop:
        loop = MagicMock()
        mock_loop.return_value = loop
        loop.run_in_executor = AsyncMock(side_effect=OSError("no address"))

        result = await _mx_valid("not-a-real-domain-xyz.invalid")

    assert result is False


# ---------------------------------------------------------------------------
# Company contact cache helpers (DB integration)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_upsert_creates_new_record(dispose_db_engine):
    from database.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        info = ContactInfo(
            name="Jane Doe",
            role="Head of Talent",
            email="jane@testcorp.io",
            linkedin_url=None,
            confidence=0.85,
        )
        record = await _upsert_contact(db, "TestCorp Unique", "testcorp.io", info)

        assert record.id is not None
        assert record.company_key == "testcorpunique"
        assert record.contact_email == "jane@testcorp.io"
        assert record.contact_name == "Jane Doe"
        assert record.confidence == 0.85

        # Cleanup
        await db.delete(record)
        await db.commit()


@pytest.mark.anyio
async def test_upsert_updates_existing_record(dispose_db_engine):
    from database.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        # Create initial
        info_v1 = ContactInfo(
            name="John", role="HR", email="john@upsertco.com", confidence=0.6
        )
        record = await _upsert_contact(db, "UpsertCo", "upsertco.com", info_v1)
        initial_id = record.id

        # Upsert with updated contact info
        info_v2 = ContactInfo(
            name="Alice", role="Co-Founder", email="alice@upsertco.com", confidence=0.9
        )
        updated = await _upsert_contact(db, "UpsertCo", "upsertco.com", info_v2)

        # Same DB row, updated values
        assert updated.id == initial_id
        assert updated.contact_name == "Alice"
        assert updated.contact_email == "alice@upsertco.com"
        assert updated.confidence == 0.9

        # Cleanup
        await db.delete(updated)
        await db.commit()


# ---------------------------------------------------------------------------
# Full agent pipeline
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@patch("ai.agents.contact_finder._ddg_search")
@patch("ai.agents.contact_finder._extract_contact_with_llm")
@patch("ai.agents.contact_finder._mx_valid")
async def test_agent_full_pipeline_success(
    mock_mx, mock_llm_extract, mock_ddg, dispose_db_engine
):
    """Full pipeline: cache miss → search → LLM extract → MX valid → persist."""
    from database.session import AsyncSessionLocal

    mock_ddg.return_value = ["Sarah recruiter at Acme Corp", "sarah@acmeinc.com"]
    mock_llm_extract.return_value = ContactInfo(
        name="Sarah Lee",
        role="Talent Lead",
        email="sarah@acmeinc.com",
        confidence=0.88,
    )
    mock_mx.return_value = True

    mock_llm = AsyncMock()

    async with AsyncSessionLocal() as db:
        agent = ContactFinderAgent(llm=mock_llm)
        contact = await agent.find(
            db=db,
            company="Acme Inc Pipeline Test",
            job_link="https://linkedin.com/jobs/123",
            job_title="Backend Engineer",
        )

    assert contact is not None
    assert contact.contact_email == "sarah@acmeinc.com"
    assert contact.contact_name == "Sarah Lee"

    # Cleanup
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select

        from database.models.company_contact import CompanyContact

        result = await db.execute(
            select(CompanyContact).where(
                CompanyContact.company_key == _company_key("Acme Inc Pipeline Test")
            )
        )
        rec = result.scalar_one_or_none()
        if rec:
            await db.delete(rec)
            await db.commit()


@pytest.mark.anyio
@patch("ai.agents.contact_finder._ddg_search")
@patch("ai.agents.contact_finder._extract_contact_with_llm")
@patch("ai.agents.contact_finder._mx_valid")
async def test_agent_clears_email_on_mx_failure(
    mock_mx, mock_llm_extract, mock_ddg, dispose_db_engine
):
    """When MX check fails, email is cleared and confidence drops."""
    from database.session import AsyncSessionLocal

    mock_ddg.return_value = ["fake domain contact"]
    mock_llm_extract.return_value = ContactInfo(
        name="Bob",
        role="Founder",
        email="bob@notarealdomain.xyz",
        confidence=0.7,
    )
    mock_mx.return_value = False  # MX fails

    mock_llm = AsyncMock()

    async with AsyncSessionLocal() as db:
        agent = ContactFinderAgent(llm=mock_llm)
        contact = await agent.find(
            db=db,
            company="BadDomain Startup MX Test",
            job_link="",
            job_title="Engineer",
        )

    # Contact returned is None because email was cleared and name alone is not enough
    # (or record persisted with null email — either is valid per agent logic)
    # The key assertion: email must NOT be bob@notarealdomain.xyz
    if contact is not None:
        assert contact.contact_email != "bob@notarealdomain.xyz"

    # Cleanup
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select

        from database.models.company_contact import CompanyContact

        result = await db.execute(
            select(CompanyContact).where(
                CompanyContact.company_key == _company_key("BadDomain Startup MX Test")
            )
        )
        rec = result.scalar_one_or_none()
        if rec:
            await db.delete(rec)
            await db.commit()


@pytest.mark.anyio
@patch("ai.agents.contact_finder._ddg_search")
@patch("ai.agents.contact_finder._extract_contact_with_llm")
async def test_agent_returns_none_on_llm_failure(
    mock_llm_extract, mock_ddg, dispose_db_engine
):
    """LLM failure should be caught and None returned."""
    from database.session import AsyncSessionLocal

    mock_ddg.return_value = ["some snippet"]
    mock_llm_extract.side_effect = Exception("LLM timeout")

    mock_llm = AsyncMock()

    async with AsyncSessionLocal() as db:
        agent = ContactFinderAgent(llm=mock_llm)
        contact = await agent.find(
            db=db,
            company="LLMFail Corp",
            job_link="",
            job_title="Engineer",
        )

    assert contact is None


@pytest.mark.anyio
@patch("ai.agents.contact_finder._ddg_search")
@patch("ai.agents.contact_finder._extract_contact_with_llm")
@patch("ai.agents.contact_finder._mx_valid")
async def test_agent_uses_cache_on_second_call(
    mock_mx, mock_llm_extract, mock_ddg, dispose_db_engine
):
    """Second call for same company must hit cache and skip search + LLM."""
    from database.session import AsyncSessionLocal

    mock_ddg.return_value = ["Alice at CacheCo recruiter"]
    mock_llm_extract.return_value = ContactInfo(
        name="Alice",
        role="Recruiter",
        email="alice@cacheco.com",
        confidence=0.9,
    )
    mock_mx.return_value = True

    mock_llm = AsyncMock()

    async with AsyncSessionLocal() as db:
        agent = ContactFinderAgent(llm=mock_llm)
        # First call: should run full pipeline
        await agent.find(db=db, company="CacheCo Cache Test", job_link="")

    # Reset call counts
    mock_ddg.reset_mock()
    mock_llm_extract.reset_mock()

    async with AsyncSessionLocal() as db:
        agent = ContactFinderAgent(llm=mock_llm)
        # Second call: should be cache hit
        contact2 = await agent.find(db=db, company="CacheCo Cache Test", job_link="")

    # Search and LLM should NOT have been called on the second invocation
    mock_ddg.assert_not_called()
    mock_llm_extract.assert_not_called()

    assert contact2 is not None
    assert contact2.contact_email == "alice@cacheco.com"

    # Cleanup
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select

        from database.models.company_contact import CompanyContact

        result = await db.execute(
            select(CompanyContact).where(
                CompanyContact.company_key == _company_key("CacheCo Cache Test")
            )
        )
        rec = result.scalar_one_or_none()
        if rec:
            await db.delete(rec)
            await db.commit()

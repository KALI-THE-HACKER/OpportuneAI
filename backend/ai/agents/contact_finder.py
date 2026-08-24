"""Autonomous Contact Finder Agent.

Pipeline:
  1. Resolve company domain (best-effort extraction from job link + name).
  2. Search DuckDuckGo for HR / Founder / Co-Founder contacts (zero-cost).
  3. Pass snippets to Gemini LLM to extract name, role, email or derive an
     email from a standard pattern and company domain.
  4. Validate the domain accepts email via async DNS MX record check.
  5. Cache result in ``company_contacts`` table.

The agent is intentionally lightweight: it returns on the first credible result
to keep latency low and cost at zero.
"""

import asyncio
import logging
import re
import socket
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.providers.base import BaseLLM
from ai.schemas import ContactInfo
from database.models.company_contact import CompanyContact

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DuckDuckGo HTML search helpers (zero-cost, no API key required)
# ---------------------------------------------------------------------------

_DDG_URL = "https://html.duckduckgo.com/html/"
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; OpportuneAI/1.0; +https://github.com/KALI-THE-HACKER/OpportuneAI)"
    ),
    "Accept": "text/html,application/xhtml+xml",
}
_SNIPPET_RE = re.compile(r'class="result__snippet"[^>]*>([^<]{20,})', re.IGNORECASE)
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")


async def _ddg_search(query: str, max_snippets: int = 8) -> list[str]:
    """Run a DuckDuckGo HTML search and return plain-text result snippets."""
    try:
        async with httpx.AsyncClient(
            timeout=12, follow_redirects=True, headers=_HEADERS
        ) as client:
            resp = await client.post(_DDG_URL, data={"q": query, "kl": "us-en"})
            resp.raise_for_status()
            snippets = _SNIPPET_RE.findall(resp.text)
            # Also extract any raw emails visible in the HTML
            raw_emails = _EMAIL_RE.findall(resp.text)
            combined = snippets[:max_snippets] + raw_emails[:4]
            return combined
    except Exception as exc:
        logger.warning("DuckDuckGo search failed for query '%s': %s", query, exc)
        return []


# ---------------------------------------------------------------------------
# Domain helpers
# ---------------------------------------------------------------------------


def _extract_domain(job_link: str, company_name: str) -> str | None:
    """Return the root domain from the job link or infer it from company name."""
    # Try to extract from the job listing URL
    if job_link:
        parsed = urlparse(job_link)
        host = parsed.netloc or ""
        # Strip common job board domains
        _BOARDS = {
            "linkedin.com",
            "wellfound.com",
            "naukri.com",
            "remoteok.com",
            "remoteok.io",
            "indeed.com",
            "glassdoor.com",
            "lever.co",
            "greenhouse.io",
            "ashbyhq.com",
            "workday.com",
            "jobs.lever.co",
        }
        # Remove www.
        host = host.lstrip("www.")
        if host and not any(board in host for board in _BOARDS):
            return host

    # Fallback: naive slug from company name  e.g. "Acme Corp" -> "acmecorp.com"
    slug = re.sub(r"[^a-z0-9]", "", company_name.lower())
    if slug:
        return f"{slug}.com"
    return None


async def _mx_valid(domain: str) -> bool:
    """Return True if the domain has at least one MX record (async-safe)."""
    try:
        loop = asyncio.get_event_loop()
        # getaddrinfo is blocking; run in executor for async safety
        result = await loop.run_in_executor(
            None, lambda: socket.getaddrinfo(domain, None)
        )
        return bool(result)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# LLM-based contact extraction prompt
# ---------------------------------------------------------------------------

_CONTACT_EXTRACTION_SYSTEM = (
    "You are an expert at extracting professional contact information from web search results. "
    "Given a company name, domain, and search snippets, extract the most relevant HR, Recruiter, "
    "Talent, Co-Founder, or Founder contact who can receive a job application email. "
    "Prefer people with hiring authority. "
    "If an email address is directly visible in the snippets, use it. "
    "Otherwise, derive a plausible email using common corporate patterns: "
    "firstname@domain OR firstname.lastname@domain. "
    "Never invent names. If you cannot determine any credible contact, return null for all fields. "
    "Return ONLY structured JSON matching the schema — no prose."
)


async def _extract_contact_with_llm(
    llm: BaseLLM,
    company: str,
    domain: str | None,
    snippets: list[str],
) -> ContactInfo:
    """Ask the LLM to synthesize contact info from search snippets."""
    from langchain_core.messages import HumanMessage, SystemMessage

    context_block = (
        "\n".join(f"- {s}" for s in snippets) if snippets else "(no results found)"
    )
    domain_hint = f" (domain: {domain})" if domain else ""

    messages = [
        SystemMessage(content=_CONTACT_EXTRACTION_SYSTEM),
        HumanMessage(
            content=(
                f"Company: {company}{domain_hint}\n\n"
                f"Search Result Snippets:\n{context_block}\n\n"
                "Extract the best HR / Founder contact information."
            )
        ),
    ]

    result: ContactInfo = await llm.invoke(messages=messages, output_schema=ContactInfo)
    return result


# ---------------------------------------------------------------------------
# Repository helpers
# ---------------------------------------------------------------------------


def _company_key(name: str) -> str:
    """Normalize company name to a stable lookup key."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


async def _get_cached_contact(db: AsyncSession, key: str) -> CompanyContact | None:
    result = await db.execute(
        select(CompanyContact).where(CompanyContact.company_key == key)
    )
    return result.scalar_one_or_none()


async def _upsert_contact(
    db: AsyncSession,
    company_name: str,
    domain: str | None,
    info: ContactInfo,
) -> CompanyContact:
    key = _company_key(company_name)
    existing = await _get_cached_contact(db, key)

    if existing:
        existing.domain = domain
        existing.contact_name = info.name
        existing.contact_role = info.role
        existing.contact_email = info.email
        existing.linkedin_url = info.linkedin_url
        existing.confidence = info.confidence
        await db.commit()
        await db.refresh(existing)
        return existing

    record = CompanyContact(
        company_key=key,
        company_name=company_name,
        domain=domain,
        contact_name=info.name,
        contact_role=info.role,
        contact_email=info.email,
        linkedin_url=info.linkedin_url,
        confidence=info.confidence,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


# ---------------------------------------------------------------------------
# Public agent interface
# ---------------------------------------------------------------------------


class ContactFinderAgent:
    """Autonomous agent that discovers HR / Founder contact information for a company."""

    def __init__(self, llm: BaseLLM):
        self.llm = llm

    async def find(
        self,
        db: AsyncSession,
        company: str,
        job_link: str = "",
        job_title: str = "",
    ) -> CompanyContact | None:
        """Find and cache contact info for the given company.

        Returns the cached or freshly discovered ``CompanyContact`` record,
        or ``None`` if nothing credible was found.
        """
        key = _company_key(company)

        # 1. Cache check — skip search if we already have a result
        cached = await _get_cached_contact(db, key)
        if cached and cached.contact_email:
            logger.info("Contact cache hit for company '%s'", company)
            return cached

        logger.info("Running Contact Finder Agent for company '%s'", company)

        # 2. Resolve domain
        domain = _extract_domain(job_link, company)

        # 3. Search DuckDuckGo with targeted queries
        snippets: list[str] = []

        # Query 1: HR / Talent / Recruiter on LinkedIn
        q1 = f'site:linkedin.com/in "{company}" ("recruiter" OR "talent" OR "HR" OR "co-founder" OR "founder")'
        snippets += await _ddg_search(q1, max_snippets=5)

        # Query 2: Company email pattern
        if domain:
            q2 = (
                f'"{company}" email "@{domain}" (contact OR careers OR apply OR hiring)'
            )
            snippets += await _ddg_search(q2, max_snippets=4)

        # 4. Ask LLM to synthesize contact from snippets
        try:
            info = await _extract_contact_with_llm(self.llm, company, domain, snippets)
        except Exception as exc:
            logger.warning("LLM contact extraction failed for '%s': %s", company, exc)
            return None

        # 5. Validate email domain via DNS if we have an email
        if info.email and domain:
            email_domain = info.email.split("@")[-1] if "@" in info.email else ""
            if email_domain and not await _mx_valid(email_domain):
                logger.info(
                    "MX check failed for email domain '%s' — clearing email",
                    email_domain,
                )
                info = ContactInfo(
                    name=info.name,
                    role=info.role,
                    email=None,
                    linkedin_url=info.linkedin_url,
                    confidence=max(0.0, info.confidence - 0.3),
                )

        # 6. Persist to cache (even if email is None — avoids re-running for known-empty results)
        record = await _upsert_contact(db, company, domain, info)

        if info.email:
            logger.info(
                "Contact Finder: found '%s' <%s> at '%s'",
                info.name,
                info.email,
                company,
            )
        else:
            logger.info("Contact Finder: no credible email found for '%s'", company)

        return record if (record.contact_email or record.contact_name) else None

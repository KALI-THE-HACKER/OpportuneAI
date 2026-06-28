# GEMINI.md — Gemini Integration Details

OpportuneAI utilizes Google's Gemini LLM models as its primary AI engine to extract structured data from raw, unstructured job posts. This document describes the implementation architecture, configuration parameters, and client pooling logic.

---

## Architecture: Multi-API-Key Pooling

Due to rate limits and speed limits associated with free and paid tiers of the Google Gemini API, OpportuneAI implements a thread-safe client pool: **[GeminiClientPool](backend/ai/pools/gemini_pool.py#L19-L51)**.

### Features
1. **API Key Cycling**: Under [GeminiClientPool](backend/ai/pools/gemini_pool.py#L19-L51), individual `ChatGoogleGenerativeAI` clients are initialized for each API key provided in the `GEMINI_API_KEYS` env list. The pool uses an `itertools.cycle` mechanism to distribute requests sequentially across all clients.
2. **State Tracking**: For each client, the pool tracks a [ClientState](backend/ai/pools/gemini_pool.py#L11-L17) containing:
   - Total request count.
   - Cumulative failure count.
   - A cooldown time flag (to temporarily avoid rate-limited keys).
3. **Thread Safety**: Access to client acquisition (`acquire()`) and status modifications is synchronized using standard threading `Lock` structures.

---

## Model Config & Env Variables

Ensure the following variables are configured in the `backend/.env` file:

```ini
# Core AI settings
LLM_PROVIDER=gemini
LLM_TEMPERATURE=0.0

# Gemini configurations
GEMINI_API_KEYS=["AIzaSyD-xxx1", "AIzaSyD-xxx2"]
GEMINI_MODEL=gemini-2.5-flash
```

- **`GEMINI_API_KEYS`**: Must be a JSON array string containing one or more Google AI Studio keys.
- **`GEMINI_MODEL`**: The version of Gemini to use. Defaults to `gemini-2.5-flash` for high throughput, low latency, and native structured outputs.
- **`LLM_TEMPERATURE`**: Set to `0.0` to force deterministic responses, minimizing hallucinations when extracting facts.

---

## Structured Output Extraction

The pipeline uses LangChain's built-in structured output mechanism.

```python
# From backend/ai/providers/gemini.py
structured_llm = client.with_structured_output(output_schema)
response = await structured_llm.ainvoke(messages)
```

The output conforms to the [JobExtraction](backend/ai/schemas.py#L5-L14) schema, returning the following schema parameters:
- `job_title` (string)
- `company` (string)
- `skills` (list of strings)
- `location` (string)
- `salary` (optional string)
- `experience_years` (optional integer)
- `employment_type` (optional string)
- `job_description` (string)

---

## Validation & Testing

To run the dedicated test suites for the Gemini provider:
```bash
cd backend
pytest tests/ai/test_gemini.py
```

This tests the client pool acquisition, client instantiation, key configuration loading, and mock structured invokes.

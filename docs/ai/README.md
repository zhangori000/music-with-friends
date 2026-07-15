# AI seam

**Status: future design scaffolding only. No AI model, agent, vector store, prompt
pipeline, or AI vendor is implemented or required by the MVP.**

## Possible future uses

- Explain already-validated aggregates in natural language.
- Translate a user's question into a bounded, typed analytics query.
- Suggest discovery prompts from consented aggregates without inventing listening facts.

AI must never be the source of play counts, minutes, rankings, authorization decisions,
provider-policy decisions, or automatic sharing. Deterministic code and SQL produce the
facts; an optional generator may narrate them.

An eventual `InsightGenerator` port should accept a minimized, versioned input and
return structured output with provenance. The default adapter is `Disabled`; product
code must work without an AI provider. Model names, prompts, and vendor SDKs stay behind
the adapter so changing providers does not change `/api/v1`.

## Activation gates

AI remains off until all of these exist:

1. Explicit user opt-in and a privacy review covering vendor retention and training.
2. A redaction layer that excludes tokens, email, relationship identifiers, and raw
   history unless a reviewed use case strictly requires it.
3. A fixed evaluation set measuring factuality, refusal, privacy leakage, latency, and
   cost against a deterministic no-AI baseline.
4. Per-user quotas, timeouts, cancellation, caching, and a monthly hard-spend ceiling.
5. Prompt/model/version tracing, output schema validation, and user-visible provenance.
6. A graceful deterministic fallback for every model error or disabled account.

If asynchronous generation later becomes useful, publish a normal outbox job through
the existing job port. Do not introduce a second event platform solely for AI.

Operational scaffolding should record request class, model/prompt version, latency,
token count, estimated cost, validation outcome, and trace ID—never prompt bodies or
personal listening data by default. AI-derived text must be deletable with its source
account and must not silently become an advertising profile.

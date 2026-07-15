# ADR 002: Use Postgres jobs before distributed EDA

- Status: **Accepted for the live-data phase; not yet implemented**
- Date: **2026-07-14**

## Context

Listening imports and provider polling must survive process restarts, rate
limits, token revocation, duplicate delivery, and temporary provider failures.
They do not initially require a broker, independently deployed consumers, or a
replayable organization-wide event log.

The current app is a synthetic demo with an empty database schema. This ADR
chooses the next live-data baseline; it does not describe the current runtime.

## Decision

Use Postgres as the source of truth for evidence, sync cursors, and durable job
state. A scheduled process inserts or wakes jobs; workers claim a bounded due
batch using transactional row locking such as `FOR UPDATE SKIP LOCKED`.

Each job contains a stable ID and idempotency key, owner/connection reference,
kind, status, attempt count, `next_attempt_at`, lease timestamps, and a small
validated payload. The state machine is:

```text
queued -> running -> succeeded
             |  \
             |   -> dead
             -> retry_wait -> queued
```

Workers re-read authoritative connection state before calling a provider.
Evidence insertion uses a provider-scoped unique key, so retrying a page cannot
double-count listens. Evidence and the next sync cursor commit in the same
transaction. Backoff honors `Retry-After` or rate-limit headers and includes a
retry budget plus jitter.

Use an outbox in the same transaction only when a committed fact must trigger a
separate durable reaction. Outbox delivery is at least once; consumers dedupe by
event ID. Internal function calls remain the default for synchronous workflows.

## Why this is not distributed EDA

An event is a past business fact, not a job command with a fashionable name.
Most initial asynchronous work is targeted work distribution: “sync this
connection.” A database job queue provides durability and visibility without
introducing broker operations, distributed schemas, hidden choreography, or
another consistency boundary.

We are also not choosing event sourcing. Normalized evidence rows are the
source of truth; jobs and outbox records support reliable processing.

## Consequences

Benefits:

- one transactional boundary for evidence, cursor, and job state;
- inspectable recovery and simple local tests;
- low operating cost and no broker dependency;
- a transactional outbox preserves a later migration path.

Costs:

- polling adds bounded latency and database load;
- job workers share the Postgres availability boundary;
- careful leases, idempotency, and poison-job handling are still required;
- Postgres is not an unbounded event-retention system.

## Operations and tests

Measure oldest-due-job lag, queue depth by kind/status, attempts, provider error
class, rate-limit resets, lease recovery, evidence dedupe conflicts, and cursor
age. Alerts should key on lag and terminal failures, not only HTTP health.

Contract and integration tests must cover duplicate job claims, worker crash
after provider response, cursor/evidence atomicity, stale lease recovery,
revoked credentials, rate-limit retry, malformed payload quarantine, and
disconnect while a job is due.

## Revisit when

Adopt a managed queue or log only when evidence shows one or more of:

- sustained backlog or lock contention beyond the Postgres worker envelope;
- a module needs independent failure isolation or scaling;
- multiple external consumers need a stable event contract and replay;
- retention, ordering, or fan-out requirements exceed an outbox;
- database polling cost materially harms online transactions.

Preserve job/event IDs and idempotent sinks during migration. A broker changes
transport; it does not remove duplicate delivery or reconciliation work.

Further reading: [event-driven architecture](https://learning.oreilly.com/library/view/fundamentals-of-software/9781098175504/ch15.html)
and [stream processing](https://learning.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/ch12.html).

# Architecture

## Mental model

Music with Friends is a **modular monolith**: one backend deployment and one
versioned HTTP API, with business capabilities separated behind domain and
application boundaries. The Next.js web client and Expo iPhone client are two
presentations of the same product, not two backends.

```text
Web client ─────┐
                ├── /api/v1 ── application use cases ── domain
iPhone client ─┘                         │
                             ports implemented by adapters
                             (Postgres, jobs, providers)
```

The current deployed slice is narrower: `/api/v1/demo` returns synthetic data
and the hosting configuration has no database binding. Postgres, authentication,
live ingestion, and row-level authorization are accepted next-phase designs,
not claims about running code.

## Module responsibilities

| Module | Owns | Does not own |
| --- | --- | --- |
| Identity | App users, sessions, account lifecycle | Music-provider credentials |
| Social | Friend state, groups, membership, profile visibility | Provider publicity or consent |
| Connections | Provider ownership proof, encrypted credentials, consent, sync cursors | Analytics semantics |
| Listening | Normalized evidence and its provenance | Provider HTTP details |
| Analytics | Half-open range queries and evidence-derived views | Unsupported inference from provider data |
| Contracts | Versioned `/api/v1` request and response schemas | Persistence models |
| Infrastructure | Postgres, durable jobs, provider clients, clocks | Business policy |

The repository currently expresses these seams through
[`src/domain`](../../src/domain), [`src/application`](../../src/application),
[`src/infrastructure`](../../src/infrastructure), and
[`src/contracts`](../../src/contracts). As live capabilities grow, organize
within those layers by the module names above rather than creating a global
shared-model directory.

## Dependency rules

1. Clients depend on `/api/v1`, never on database or provider shapes.
2. Application use cases depend on domain types and ports.
3. Infrastructure implements ports and validates untrusted provider payloads.
4. Domain code imports no React, Next.js, Drizzle, database, or provider SDK.
5. Provider evidence enters analytics only when its declared capability allows
   derived analytics.
6. Social visibility is checked on every personalized read; public upstream
   data is never treated as app-level consent.

The [architecture fitness test](../../tests/architecture/dependency-boundaries.test.ts)
currently enforces the framework-free domain rule. Add dependency and schema
contract tests as modules become real.

## Time and metric semantics

- Every analytics range is half-open: `[start, end)`.
- Convert a user's calendar preset in their IANA timezone, then persist/query
  UTC instants. Half-open ranges prevent double-counting at adjacent boundaries.
- `actualDurationMs` is nullable. `null` means unknown, not zero.
- Catalog track duration is never substituted for actual listening time.
- Minutes carry `exact`, `partial`, or `unavailable` quality and a coverage
  ratio, as implemented in the [aggregator](../../src/domain/listening/aggregate.ts).
- A top playlist exists only when allowed evidence contains verified playlist
  context. Missing context produces `null`, not a guessed playlist.

## Persistence and asynchronous work

Postgres is the intended live system of record. Module ownership is logical:
tables share one database initially, while application code accesses another
module's data through its public use cases rather than ad hoc cross-module SQL.

Provider synchronization is asynchronous but does not initially require a
distributed event platform. A Postgres job table holds durable work, retry
state, cursors, and idempotency keys. Workers claim bounded batches and update
evidence plus cursor transactionally. An outbox is added only for facts that
must survive commit and feed another reaction.

Messages may be delivered more than once; business effects remain idempotent.
We do not claim exactly-once transport, and listening evidence is not an
event-sourced domain model.

## Security and privacy boundary

- Provider secrets stay server-side and encrypted.
- Ownership proof and sharing consent are separate facts.
- Authorization is evaluated against accepted friendship or active group
  membership, matching the [visibility domain rule](../../src/domain/social/visibility.ts).
- Provider-derived rows retain source and policy provenance.
- Disconnect and account deletion cancel work, erase credentials, and remove
  app-held data according to the user's choice and provider terms.
- ListenBrainz remains public upstream even when this app displays a profile as
  private, friends-only, or group-only.

## Decisions

- [ADR 001: Modular monolith](adr/001-modular-monolith.md)
- [ADR 002: Postgres jobs before distributed EDA](adr/002-postgres-jobs-before-distributed-eda.md)
- [ADR 003: Listening evidence and provider policy](adr/003-listening-evidence-and-provider-policy.md)
- [Logical data model](../data/data-model.md)
- [Provider feasibility](../product/provider-feasibility.md)

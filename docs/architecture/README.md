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

The current deployed slice has two paths: `/api/v1/demo` returns synthetic
social data, while the web-only Spotify history beta parses user-selected files
and queries IndexedDB without calling the API. The hosting configuration has no
database binding. Postgres, authentication, social history synchronization,
live provider ingestion, iPhone import, and row-level authorization are accepted
next-phase designs, not claims about running code.

```text
User-selected Spotify JSON
          │ browser memory (raw file)
          ▼
validate + normalize + dedupe
          │ minimal evidence only
          ▼
       IndexedDB ── local range/top/recent queries

No raw upload; no API/social/mobile sync
```

## Module responsibilities

| Module | Owns | Does not own |
| --- | --- | --- |
| Identity | App users, sessions, account lifecycle | Music-provider credentials |
| Social | Friend state, groups, membership, profile visibility | Provider publicity or consent |
| Connections | Provider ownership proof, encrypted credentials, consent, sync cursors | Analytics semantics |
| Listening | Normalized evidence and its provenance | Provider HTTP details or raw import files |
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
   derived analytics. Spotify Web API and `manual-import` are separate sources;
   one must never be relabeled as the other.
6. Social visibility is checked on every personalized read; public upstream
   data is never treated as app-level consent.
7. Raw user files terminate at the browser import boundary. Only the documented
   normalized allowlist may enter IndexedDB.

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
- For local Spotify imports, “exact minutes” is the exact sum of accepted
  provider-reported `ms_played`, not an assertion of archive completeness.
- Imported-history top artist and recent 20 operate on accepted rows in the
  selected half-open range; an optional short-play threshold changes the view,
  not the stored source evidence.

The export cannot identify historical playlist context. Product-safe
alternatives are separately named metrics: most launched through this app,
approximate playlist affinity based on user-supplied inventory after policy
review, or user-attested source. None is “most played playlist.”

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

The local importer is intentionally outside this job system: it is synchronous,
user-directed browser work with no server observer. A Spotify Recently Played
polling loop remains disabled pending written permission; even if approved, its
rolling 50-item window and missing actual duration cannot provide authoritative
history.

## Security and privacy boundary

- Provider secrets stay server-side and encrypted.
- Ownership proof and sharing consent are separate facts.
- Authorization is evaluated against accepted friendship or active group
  membership, matching the [visibility domain rule](../../src/domain/social/visibility.ts).
- Provider-derived rows retain source and policy provenance.
- Local Spotify export rows remain in IndexedDB; raw files are neither uploaded
  nor retained, and podcasts plus private/incognito rows are ignored.
- Disconnect and account deletion cancel work, erase credentials, and remove
  app-held data according to the user's choice and provider terms.
- ListenBrainz remains public upstream even when this app displays a profile as
  private, friends-only, or group-only.

## Decisions

- [ADR 001: Modular monolith](adr/001-modular-monolith.md)
- [ADR 002: Postgres jobs before distributed EDA](adr/002-postgres-jobs-before-distributed-eda.md)
- [ADR 003: Listening evidence and provider policy](adr/003-listening-evidence-and-provider-policy.md)
- [ADR 004: Browser-local Spotify history import](adr/004-browser-local-spotify-history-import.md)
- [Logical data model](../data/data-model.md)
- [Provider feasibility](../product/provider-feasibility.md)

# Logical data model

Status: **Accepted design; live tables are not yet implemented**

No runtime application database is currently configured. This document defines
the Postgres model for the live-data phase. Names are logical; migrations may
refine them without weakening the invariants below.

## Ownership map

| Table | Module | Purpose |
| --- | --- | --- |
| `app_user` | Identity | Product identity and lifecycle |
| `profile` | Social | Display fields, IANA timezone, visibility |
| `friendship` | Social | Requested/accepted/blocked relationship state |
| `social_group` | Social | Group metadata and visibility |
| `group_membership` | Social | Invited/active/left/removed membership state |
| `provider_connection` | Connections | Ownership proof, consent, encrypted credential reference, status |
| `ingestion_cursor` | Connections | Provider-specific high-water mark and sync health |
| `listening_evidence` | Listening | Normalized timestamped evidence and provenance |
| `track_identity` | Listening | Source identifiers and normalized display metadata |
| `ingestion_job` | Infrastructure | Durable scheduled/retry work |
| `outbox_event` | Infrastructure | Committed facts awaiting at-least-once delivery |
| `consent_record` | Connections | Versioned ingestion and sharing acknowledgement |

Precomputed analytics are optional caches, not the evidence source of truth.
Add them only after query measurements justify the maintenance cost.

## Core relationships

```text
app_user 1──1 profile
app_user 1──* provider_connection 1──1 ingestion_cursor
app_user 1──* listening_evidence *──1 track_identity
app_user *──* app_user          through friendship
app_user *──* social_group      through group_membership
provider_connection 1──* ingestion_job
```

## Listening evidence

Suggested columns:

```sql
listening_evidence (
  id                    uuid primary key,
  owner_user_id         uuid not null,
  connection_id         uuid not null,
  source                text not null,
  evidence_kind         text not null,
  provider_evidence_key text not null,
  played_at             timestamptz,
  actual_duration_ms    bigint,
  track_identity_id     uuid not null,
  context_kind          text,
  context_provider_id   text,
  context_name          text,
  context_quality       text,
  consent_record_id     uuid not null,
  provider_policy_date  date not null,
  ingested_at           timestamptz not null,
  unique (connection_id, provider_evidence_key)
)
```

Invariants:

- `played_at` may be null only for non-historical snapshots such as playing-now;
  analytics ignore evidence without an event time.
- `actual_duration_ms` is nullable and nonnegative. Null means unknown.
- Track catalog duration belongs on `track_identity`; it never fills
  `actual_duration_ms`.
- Context is optional. `context_quality = 'verified'` is required before a
  context participates in a top-playlist metric.
- Provider evidence keys are stable and idempotent within one connection. If a
  provider lacks an event ID, the adapter defines and versions a deterministic
  fingerprint from provider identity, timestamp, and source identifiers.
- Spotify evidence is stored only for an approved direct view and is excluded
  from derived analytics by domain policy, not merely by query convention.
- Store only normalized fields needed by the product. Raw provider payloads are
  off by default; any diagnostic retention must be encrypted, short-lived, and
  covered by provider terms and consent.

## Track identity

Do not assume provider IDs are globally interchangeable. `track_identity`
stores display metadata plus separate source identifiers or mappings. Prefer a
MusicBrainz recording ID when confidently mapped, but retain original source
identity and mapping provenance. A fuzzy title/artist match is not authority to
merge historical evidence destructively.

Artwork and external URLs retain their own provider, license, and expiry
semantics. Last.fm artwork is excluded by its standard API terms; Spotify and
other assets must follow their current attribution and caching rules.

## Time-range contract

Every analytics query uses a half-open interval:

```sql
where played_at >= :start_at
  and played_at <  :end_at
```

For `this_week`, `this_month`, and `this_year`, calculate calendar boundaries
in `profile.time_zone` using an IANA timezone, then convert them to UTC. Never
construct a month by adding a fixed number of hours. For `all_time`, use a
stable query snapshot end, normally the response's `generated_at`, so pagination
and repeated subqueries describe the same window.

Late imports are allowed. They change past aggregates; caches therefore need a
dirty-range or version invalidation strategy rather than assuming event-time
order equals ingestion order.

## Duration and aggregate quality

For a range containing `N` eligible listens and `A` listens with non-null actual
duration:

```text
coverageRatio = N == 0 ? 0 : A / N
minutes       = sum(actual_duration_ms where non-null) / 60_000
quality       = A == 0 ? unavailable : A == N ? exact : partial
```

The partial value is the known subtotal, not an estimate of the missing
duration. API responses must preserve both quality and coverage.

## Social authorization

`profile.visibility` is one of `private`, `friends`, `groups`, or `public`.
Authorization uses current accepted friendship and active group membership;
invites and blocked/left memberships do not grant access. The owner always has
access. Apply the rule to raw evidence, aggregate reads, exports, and share-link
generation.

Provider publicity is separate. A friends-only app profile backed by
ListenBrainz still has public upstream history. `consent_record` stores the
disclosure version the user accepted; it does not pretend to alter upstream
visibility.

## Connections, tokens, and consent

`provider_connection` stores connection status and a reference to encrypted
server-side credentials, never plaintext tokens. For read-only ListenBrainz,
validate the user token once and discard it after recording the proven username
unless a write feature requires continuing authorization.

Keep separate timestamps/versions for ownership proof, ingestion consent,
social sharing consent, terms/policy acknowledgement, revocation, and deletion.
This makes “connected” insufficient by itself to authorize a new data use.

## Durable jobs and outbox

`ingestion_job` has `queued`, `running`, `retry_wait`, `succeeded`, and `dead`
states; a unique idempotency key; bounded attempts; next-attempt time; lease
owner/expiry; and sanitized payload. Jobs are commands, not domain events.

`outbox_event` contains a stable event ID, deliberate event type/version,
minimal contextual payload, creation time, and delivery state. Insert it in the
same transaction as the authoritative change. Delivery is at least once, so
every consumer records or otherwise enforces event-id idempotency.

## Deletion

Disconnect immediately prevents new claims and erases credentials. User data
deletion must cascade or explicitly purge evidence, cursors, pending jobs,
cached aggregates, exports, and unneeded outbox payloads. Keep only the minimal
non-identifying audit record required by law or abuse prevention, with a stated
retention period.

Deletion of this database does not delete ListenBrainz or another provider's
copy. Conversely, provider deletion should be reconciled into this app when we
receive or detect it. Public CC0 data may already exist in third-party dumps, so
the UI must not promise universal erasure.

# ADR 003: Model listening evidence and enforce provider policy

- Status: **Accepted**
- Date: **2026-07-14**

## Context

Providers expose facts with different semantics and licenses. A Spotify recent
item is not proof of full-track listening; Spotify top items are affinity, not
play counts; ListenBrainz may have a timestamped listen without actual duration
or source-playlist context. Flattening these into one “play” shape would create
false precision and policy violations.

## Decision

Store normalized **listening evidence**, not an asserted universal truth. Every
record carries source, evidence kind, provider-scoped identity, event time,
nullable actual duration, catalog track data, optional verified context, and
policy/consent provenance.

Provider capabilities are executable policy:

- Spotify derived analytics are blocked. Spotify evidence may power direct
  provider views and link-out, but never play-count, minute, top-item, playlist,
  comparison, or leaderboard aggregation.
- ListenBrainz analytics are allowed after ownership proof and explicit consent.
  Its history is public upstream; app visibility does not change that fact.
- Demo evidence is synthetic and may exercise every analytics path.
- New providers default to policy review until official documentation, terms,
  implementation, and contract tests agree.

The current [capability map](../../../src/domain/providers/capabilities.ts) and
[aggregation guard](../../../src/domain/listening/aggregate.ts) enforce the
first version of this rule.

## Time and duration contract

Analytics use half-open ranges `[start, end)`: include evidence at `start`,
exclude evidence at `end`. Adjacent windows therefore neither overlap nor leave
a gap. Calendar boundaries are computed in the user's IANA timezone and stored
as UTC instants.

`actualDurationMs` is nullable:

- non-null means the source supplied actual listened duration;
- `null` means unknown, never zero;
- catalog duration remains a separate field and is never substituted;
- totals report `exact` only at 100% duration coverage, `partial` between 0%
  and 100%, and `unavailable` at 0%.

Top playlist is nullable. It can be computed only from allowed evidence with
verified playlist context. ListenBrainz currently maps context to `null`, and
Spotify context must not be used to derive the metric.

## Consent, privacy, and deletion

Ownership proof, provider authorization, ingestion consent, and sharing
visibility are separate records. Public provider data is not implicit consent.

App authorization is evaluated for owner, accepted friends, active shared-group
members, or anonymous public viewers. It applies to raw history and aggregates.
On disconnect or deletion, cancel pending ingestion, erase credentials, and
delete or retain imported evidence only according to an explicit user choice
and the provider terms. Upstream deletion is a separate provider operation.

## Consequences

Benefits:

- false precision is visible in the API rather than hidden in implementation;
- provider policy changes are localized to capability declarations and adapters;
- new ingestion sources can map into a stable domain model;
- tests can assert policy, time, dedupe, and duration invariants.

Costs:

- some requested cards must say unavailable or partial;
- queries and UI must preserve provenance and quality;
- cross-provider identity resolution remains imperfect;
- policy changes require periodic review and possibly deletion or migration.

## Alternatives rejected

- **One generic play record with required duration/context:** invents data that
  sources do not provide.
- **Estimate minutes from track length:** overstates skipped or partial plays.
- **Aggregate Spotify and relabel the result:** still derives prohibited user
  analytics from Spotify data.
- **Use Last.fm as the default workaround:** its standard API terms impose
  non-commercial, retention, artwork, approval, and attribution constraints.

## Compliance and revalidation

Keep unit tests that reject Spotify aggregation, preserve null actual duration,
dedupe evidence IDs, and enforce `[start, end)`. Add adapter contract fixtures
for every provider. Record policy review date and source URLs in release
documentation, and re-open this ADR before monetization or a provider expansion.

Official sources: [Spotify Developer Policy](https://developer.spotify.com/policy),
[Spotify Recently Played](https://developer.spotify.com/documentation/web-api/reference/get-recently-played),
[ListenBrainz Core API](https://listenbrainz.readthedocs.io/en/latest/users/api/core.html),
[ListenBrainz JSON schema](https://listenbrainz.readthedocs.io/en/latest/users/json.html),
and [ListenBrainz terms](https://listenbrainz.org/terms-of-service/).

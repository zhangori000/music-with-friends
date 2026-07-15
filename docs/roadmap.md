# Roadmap

The roadmap is capability-gated, not date-driven. Every phase begins with failing
contracts and ends only when its verification and privacy gates pass.

## 0. Public synthetic slice and local-history web beta — current

- Next/vinext web dashboard and versioned demo API.
- Expo SDK 57 iPhone client consuming the same `/api/v1` contract.
- Provider capability model plus Spotify, ListenBrainz, and demo adapters.
- Policy guard preventing derived analytics from Spotify evidence.
- Browser-only import of user-selected Spotify Extended Streaming History JSON.
- Minimal normalized evidence in IndexedDB; raw files never leave the browser.
- Arbitrary local ranges, exact sums of provider-reported listened milliseconds,
  imported-history top artist, and latest 20 imported music plays.
- Ignore podcasts and private/incognito rows; expose rejected-row counts without
  retaining raw payloads.
- Domain, contract, integration, architecture, build-smoke, and bundle checks.

This phase has no production account system, server database, social history sync,
iPhone history import, provider observer, or distributed queue. Clearing the local
import removes the app's IndexedDB copy from that browser profile.

## 1. Trust and persistence foundation

- Design Postgres tables for accounts, connections, friendships, groups, memberships,
  consent, evidence, jobs/outbox, and audit metadata.
- Add Supabase Auth and RLS without coupling the app account to Spotify.
- Encrypt provider tokens server-side and implement rotation, revocation, export,
  disconnect, and deletion.
- Replace demo-only authorization with application checks plus negative RLS tests.

Exit: local integration tests and the security release gates pass.

## 2. Policy-compatible private beta data

- Validate ownership and import consented ListenBrainz history idempotently.
- Schedule bounded sync jobs and expose evidence quality/coverage in every aggregate.
- Add Spotify OAuth for direct recent/top-item views and discovery links only; do not
  calculate new Spotify listening metrics.
- Keep any continuous Spotify Recently Played observer disabled unless Spotify gives
  written permission for the intended collection, storage, calculations, and social
  display. Permission would not repair the endpoint's completeness or duration gaps.
- Add structured operational metrics, rate limits, retries, and recovery runbooks.

Exit: no synthetic value can be mistaken for live data, and disconnect/deletion works
end to end.

## 3. Friends, groups, and iPhone beta

- Ship invitations, blocking, group roles, revocable sharing, and opt-in public profiles.
- Decide whether a user may explicitly publish imported-export aggregates only after
  policy/legal review, a consent design, deletion semantics, and abuse tests. Local
  availability is not authorization for server upload or redistribution.
- Add Playwright and Maestro smoke flows against production-like builds.
- Distribute to close friends with TestFlight. Apple Developer Program enrollment is
  **$99 USD/year**; see [Apple's membership details](https://developer.apple.com/support/compare-memberships/).
- Collect explicit feedback and validate provider limits, privacy language, retention,
  performance, and accessibility.

## 4. Measured scale and provider expansion

- Add daily rollups, partitions, caching, or a distributed queue only when the measured
  triggers in `docs/operations/cost-and-scale.md` fire.
- Re-evaluate Apple Music and YouTube Music against current official APIs and terms;
  implement only capabilities that pass policy and contract review.
- Add observability/export adapters without making a vendor part of the domain.

## Later, separately approved

- AI insights remain behind the disabled seam in `docs/ai/README.md`.
- Advertising remains behind the no-ads seam in `docs/ads/README.md`.

Neither is part of MVP or private-beta acceptance criteria.

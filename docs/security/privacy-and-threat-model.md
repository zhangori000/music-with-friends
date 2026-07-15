# Privacy and threat model

## Present boundary

The current public app serves synthetic data. It has no live user database, persisted
provider token, friend graph, or ingestion worker. The visibility function and provider
capability guards are tested domain rules, but they are not yet a production
authorization system.

The public demo API is intentionally unauthenticated and cacheable. The live phase
will introduce app-owned authentication and must not trust client-supplied identity
headers.

## Assets and trust boundaries

Future live data introduces:

- restricted secrets: provider refresh tokens, service-role credentials, encryption
  keys, cron secrets, and OAuth verifier/state values;
- sensitive personal data: timestamped listening evidence and derived preferences;
- relationship data: profiles, friendships, group membership, invitations, visibility,
  and consent records;
- public data: only fields a user explicitly elects to publish, still subject to
  correction and deletion.

Clients, API requests, music providers, the hosting edge, Supabase, Expo/Apple, and any
future AI or advertising vendor are separate trust boundaries. Mobile and browser
clients are always untrusted.

## Principal threats and controls

| Threat | Required control before live beta |
| --- | --- |
| IDOR or stale group membership exposes history | authorize every object in the application service and enforce tested Postgres RLS as defense in depth |
| Provider or app token theft | server-only encrypted storage, key rotation, least privilege, log redaction, and revocation on disconnect |
| OAuth login/linking interception or replay | Authorization Code + PKCE, exact redirect URIs, random state/nonce, short expiry, and one-time callback consumption |
| Spoofed identity headers or JWTs | verify identity at the trusted edge/API; never accept client assertions or expose the service-role key |
| Duplicate/replayed ingestion corrupts stats | unique evidence IDs, idempotent writes, bounded jobs, and retry tests |
| Provider metadata causes XSS or unsafe navigation | schema validation, escaped rendering, HTTPS URL allowlists, CSP, and `noopener`/`noreferrer` |
| Public profiles enable scraping or harassment | private default, explicit publish consent, rate limits, blocking/reporting, and revocable public URLs |
| Logs/backups retain deleted data | data classification, retention limits, deletion runbooks, restore-aware erasure, and audit events without sensitive payloads |

Use Supabase's [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and the current OAuth security best practice, [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700), as implementation baselines.

## Privacy rules

- An app account is independent of a music-provider connection.
- Collect the minimum evidence permitted by that provider and required for the selected
  feature. Spotify data remains direct display/link-out only under the current policy
  decision; it is never input to derived listener metrics.
- “Minutes listened” may sum only `actualDurationMs`; catalog track duration is not
  evidence of listening time.
- Default a new profile and group to non-public. Record explicit consent separately
  from friendship or membership.
- Before private beta, implement export, disconnect, account deletion, provider token
  revocation, ingestion cancellation, and a documented retention period.
- Do not send raw listening history, social graphs, provider tokens, or stable user IDs
  to future AI or advertising systems by default.
- Never place secrets in `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, source control, analytics
  events, crash reports, or URLs.

## Release gates for live data

1. Negative RLS and application-authorization tests pass for owner, friend, group,
   anonymous, removed-member, and blocked-user cases.
2. Threats for OAuth link, refresh, disconnect, deletion, and secret rotation have
   automated tests and runbooks.
3. A privacy notice accurately lists stored fields, purposes, processors, retention,
   export, and deletion.
4. Rate limiting, abuse response, security headers, dependency scanning, and secret
   scanning are enabled and observed in a staging deployment.
5. Provider terms are rechecked at release time; capability declarations fail closed
   when approval is absent or unclear.

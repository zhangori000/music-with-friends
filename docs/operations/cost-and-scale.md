# Cost and scale

Snapshot: July 14, 2026. Vendor plans change; the provider dashboard is authoritative.

## Current cost shape

The source is the public
[`zhangori000/music-with-friends`](https://github.com/zhangori000/music-with-friends)
repository. The current public production deployment is
[`music-with-friends-delta.vercel.app`](https://music-with-friends-delta.vercel.app/)
on Vercel Hobby. It serves the synthetic web/API slice; there is still no runtime
application database, live provider ingestion, scheduled sync, or distributed iPhone
build. The Expo client remains a locally buildable client of the same API.

Vercel Hobby is appropriate for this personal, noncommercial preview. Its terms do
not permit commercial use. Before enabling ads, sponsorships, subscriptions, paid
features, or other commercial use, move the production deployment to an appropriate
paid Vercel plan (or another host whose plan permits that use). Approaching a resource
limit is a separate upgrade trigger; a low-traffic app can still be commercial.

The repository also contains `.openai/hosting.json` and can target Cloudflare/Sites,
but that is an alternate deployment path rather than the current public host. It
currently provisions neither D1 nor R2.

The target for this phase is $0 infrastructure. The unavoidable cost for distributing
an iPhone app to friends through TestFlight or the App Store is the Apple Developer
Program: **$99 USD per year**. Development on one's own device can be free, but free
provisioning expires after seven days. See [Apple's membership comparison](https://developer.apple.com/support/compare-memberships/).

## Free-first envelopes

| Service | Current free envelope | Plan trigger |
| --- | --- | --- |
| Vercel Hobby, current | Free included usage for personal, noncommercial projects; Vercel can pause a Hobby project after its allowance is exhausted | upgrade before any commercial use, including ads, or before sustained usage reaches the included allowance |
| Cloudflare Workers, alternate | 100,000 requests/day, 10 ms CPU/invocation, 5 Cron Triggers | evaluate only if Cloudflare becomes the active host; alert at 80,000 requests/day or 8 ms p95 CPU |
| Supabase, future | 2 active projects, 500 MB database, 50k MAU, 5 GB egress, 1 GB files, 500k Edge Function invocations | upgrade at 400 MB, 40k MAU, 4 GB egress, or 400k invocations |
| Expo EAS | 15 iOS and 15 Android builds, 60 workflow minutes, updates to 1,000 MAU | upgrade near 12 iOS builds, 45 minutes, or 800 update MAU |
| GitHub Actions, public repo | standard GitHub-hosted runners are free and unlimited; storage limits still apply, and larger runners are billed | shorten artifact retention before buying storage; require an explicit budget before selecting larger runners |

Sources: [Vercel Hobby plan](https://vercel.com/docs/plans/hobby),
[Vercel plans](https://vercel.com/docs/plans),
[Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Supabase pricing](https://supabase.com/pricing), [Expo pricing](https://expo.dev/pricing),
and [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

Supabase Free pauses inactive projects and includes no automatic backups. Upgrade to
Supabase Pro before a private beta if losing accumulated history would be unacceptable,
even when usage is below the numerical thresholds. Retention and recovery are product
requirements, not merely storage costs.

## Scaling rules

- Measure API p50/p95 latency, host execution and transfer usage, errors, provider
  throttling, rows/day, database bytes/day, ingestion lag, retries, and queue depth
  before changing topology.
- Forecast database headroom as current bytes plus 45 days of measured growth. Upgrade
  or reduce retention before that forecast reaches 500 MB.
- Keep raw evidence append-only and idempotent. Add indexed daily rollups when measured
  aggregate queries miss their latency target; do not discard source evidence to mask
  an inefficient query.
- One scheduler should claim bounded batches from a Postgres job/outbox table. A
  distributed queue is not an MVP dependency.
- Add a queue only when backlog exceeds one polling interval, failures need isolated
  retries or a dead-letter queue, replay becomes an operational requirement, or one
  bounded batch no longer fits comfortably in its execution budget.

Cloudflare Queues can be the first queue adapter if Cloudflare is selected as the
active host and those triggers occur; its Free plan currently includes 10,000
operations/day with 24-hour retention. Otherwise, keep the queue port provider-neutral
and select a Vercel-compatible managed queue from measured requirements. See [Queues
pricing](https://developers.cloudflare.com/queues/platform/pricing/).

## Cost controls to add with live data

- Hard per-user sync frequency and pagination limits.
- Provider-wide concurrency and retry budgets with jittered backoff.
- Spend/usage alerts at 50%, 75%, and 90% of each paid limit.
- Short log retention with secret and personal-data redaction.
- Feature flags defaulting AI and ads to off; traffic alone must never activate them.

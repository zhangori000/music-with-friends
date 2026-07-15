# Cost and scale

Snapshot: July 14, 2026. Vendor plans change; the provider dashboard is authoritative.

## Current cost shape

The shipped slice is a synthetic vinext/Cloudflare Worker web app plus a local Expo
client. `.openai/hosting.json` currently provisions neither D1 nor R2, and there is no
runtime application database. Do not describe Supabase, scheduled ingestion, or a
production mobile build as running today.

The target for this phase is $0 infrastructure. The unavoidable cost for distributing
an iPhone app to friends through TestFlight or the App Store is the Apple Developer
Program: **$99 USD per year**. Development on one's own device can be free, but free
provisioning expires after seven days. See [Apple's membership comparison](https://developer.apple.com/support/compare-memberships/).

## Free-first envelopes

| Service | Current free envelope | Plan trigger |
| --- | --- | --- |
| Cloudflare Workers | 100,000 requests/day, 10 ms CPU/invocation, 5 Cron Triggers | alert at 80,000 requests/day or 8 ms p95 CPU; pay before the limit is sustained |
| Supabase, future | 2 active projects, 500 MB database, 50k MAU, 5 GB egress, 1 GB files, 500k Edge Function invocations | upgrade at 400 MB, 40k MAU, 4 GB egress, or 400k invocations |
| Expo EAS | 15 iOS and 15 Android builds, 60 workflow minutes, updates to 1,000 MAU | upgrade near 12 iOS builds, 45 minutes, or 800 update MAU |
| GitHub Actions, private Free repo | 2,000 minutes/month and 500 MB artifacts | alert at 1,600 minutes or 400 MB; shorten artifact retention first |

Sources: [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Supabase pricing](https://supabase.com/pricing), [Expo pricing](https://expo.dev/pricing), and [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

Supabase Free pauses inactive projects and includes no automatic backups. Upgrade to
Supabase Pro before a private beta if losing accumulated history would be unacceptable,
even when usage is below the numerical thresholds. Retention and recovery are product
requirements, not merely storage costs.

## Scaling rules

- Measure API p50/p95 latency, Worker CPU, errors, provider throttling, rows/day,
  database bytes/day, ingestion lag, retries, and queue depth before changing topology.
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

Cloudflare Queues can be the first queue adapter if those triggers occur; its Free plan
currently includes 10,000 operations/day with 24-hour retention. See
[Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/).

## Cost controls to add with live data

- Hard per-user sync frequency and pagination limits.
- Provider-wide concurrency and retry budgets with jittered backoff.
- Spend/usage alerts at 50%, 75%, and 90% of each paid limit.
- Short log retention with secret and personal-data redaction.
- Feature flags defaulting AI and ads to off; traffic alone must never activate them.

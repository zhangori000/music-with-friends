# Music with Friends

A social listening room for friends and groups, with one versioned API serving
both a Next.js web app and an Expo iPhone app.

The current public slice is intentionally a synthetic demo. Spotify can supply
recent tracks and Spotify-ranked top items, but its current Developer Policy
blocks apps from calculating new listener metrics. That constraint is enforced
in code and tests, not left as a product disclaimer.

## What works now

- responsive group dashboard with week/month/year/all-time filters;
- member filtering, sharing, source guidance, and Spotify discovery links;
- `/api/v1/demo/groups/friday-loop` consumed by web and iPhone clients;
- Spotify and ListenBrainz provider adapters with explicit capabilities;
- domain aggregation that deduplicates evidence and only sums actual duration;
- owner/friend/group/public visibility rules;
- unit, contract, integration, architecture, production smoke, and iOS bundle checks.

## Local development

Requirements: Node 24 and npm.

```bash
npm install
npm run dev
```

The web app runs at `http://localhost:3000`.

```bash
cd apps/mobile
cp .env.example .env.local
npm install
npm run ios
```

The iOS Simulator can call `http://localhost:3000`. A physical phone needs a
LAN or public HTTPS value for `EXPO_PUBLIC_API_BASE_URL`.

## Verification

```bash
npm run test:unit
npm run test:architecture
npm run test:smoke
npm run typecheck
npm run mobile:typecheck
npm run mobile:export
```

`npm run verify` runs the full local gate.

## Architecture

```text
Web client ─────┐
                ├── /api/v1 ── application ── domain
iPhone client ─┘                     │
                           storage + provider adapters
```

This is a modular monolith. It keeps one deployable API and one transactional
data boundary while preserving extraction seams. Scheduled ingestion uses an
idempotent job/outbox table first; a distributed queue is added only after
measured backlog or isolation needs justify it.

Read these before extending the system:

- [Provider feasibility](docs/product/provider-feasibility.md)
- [Architecture overview](docs/architecture/README.md)
- [Why Postgres jobs come before distributed EDA](docs/architecture/adr/002-postgres-jobs-before-distributed-eda.md)
- [Test strategy](docs/testing/strategy.md)
- [Cost and scale triggers](docs/operations/cost-and-scale.md)
- [Privacy and threat model](docs/security/privacy-and-threat-model.md)
- [AI seam](docs/ai/README.md) and [ads seam](docs/ads/README.md)
- [OpenAPI contract](openapi/openapi.yaml) and [future Supabase migration](supabase/migrations/202607140001_initial.sql)

## Live-data path

The next product phase is app authentication, Postgres/RLS, explicit sharing
consent, ListenBrainz ownership validation/import, and deletion/disconnect.
Spotify remains a separate direct-data/link-out adapter. See
[the roadmap](docs/roadmap.md).

## License

MIT. Provider data, artwork, trademarks, and APIs remain subject to their own
terms and licenses.

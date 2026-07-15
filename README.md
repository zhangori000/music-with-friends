# Music with Friends

A social listening room for friends and groups, with one versioned API serving
both a Next.js web app and an Expo iPhone app.

**Live synthetic demo:** https://music-with-friends-delta.vercel.app

The public app contains a synthetic social dashboard and a **web beta for
private, local analysis of a user's Spotify history export**. Spotify Web API
data still cannot feed calculated listener metrics under the current
[Developer Policy](https://developer.spotify.com/policy); that constraint is
enforced in code and tests rather than left as a disclaimer.

## What works now

- responsive group dashboard with week/month/year/all-time filters;
- member filtering, sharing, source guidance, and Spotify discovery links;
- `/api/v1/demo/groups/friday-loop` consumed by web and iPhone clients;
- Spotify and ListenBrainz provider adapters with explicit capabilities;
- domain aggregation that deduplicates evidence and only sums actual duration;
- owner/friend/group/public visibility rules;
- local import of Spotify Extended Streaming History JSON in the web browser;
- exact sums of provider-reported `ms_played`, arbitrary date ranges,
  imported-history top artist, and the latest 20 imported plays;
- unit, contract, integration, architecture, production smoke, and iOS bundle checks.

The importer keeps only normalized timestamp, listened milliseconds, track,
artist, and an optional Spotify track link in IndexedDB. Raw files are never
uploaded or persisted, and podcast rows plus private/incognito rows are ignored.
This beta does **not** sync imported history to friends, groups, a server, or the
iPhone app.

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
The local Spotify import remains private until social redistribution has passed
separate policy, consent, and security review. A background Spotify observer is
disabled pending written provider permission. See [the roadmap](docs/roadmap.md).

## License

MIT. Provider data, artwork, trademarks, and APIs remain subject to their own
terms and licenses.

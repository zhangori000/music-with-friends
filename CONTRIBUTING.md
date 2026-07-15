# Contributing

## Start here

Read `AGENTS.md` and `docs/product/provider-feasibility.md`. Node 24 and npm are
required.

```bash
npm install
npm run dev
```

For iPhone development:

```bash
cd apps/mobile
cp .env.example .env.local
npm install
npm run ios
```

The root and mobile apps intentionally have separate lockfiles and React versions.
Share headless contracts and domain concepts, not framework-specific UI modules.

## Change workflow

1. Create a focused branch and define the behavior being changed.
2. Add the failing unit, contract, integration, or architecture test first.
3. Run the narrow test and confirm it fails for the expected reason.
4. Implement the smallest coherent change, then refactor.
5. Run `npm run lint` and `npm run verify` before requesting review.

Do not call live music-provider APIs from tests. Inject a deterministic `fetch` fake.

## Architecture rules

- `src/domain` imports no React, Next.js, database library, or provider SDK.
- Web and iPhone clients consume the versioned `/api/v1` contract. Contract changes
  update the Zod schema, route tests, and both consumers together.
- Provider adapters declare capabilities and fail closed. Never derive listening
  analytics from Spotify data.
- Minutes listened sum only actual listened duration, never catalog track duration.
- Keep tokens server-side and encrypted. Never commit `.env` files or put secrets in
  `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` values.
- Start with the modular monolith and transactional job/outbox seam. Distributed EDA,
  AI, and ads are not default dependencies.
- Database changes require a migration, rollback/recovery consideration, and RLS tests.

## Review checklist

- Behavior is covered at the lowest useful layer, including failure and authorization
  cases.
- The public demo still labels synthetic data unambiguously.
- New logs and errors contain no secrets or personal listening data.
- Provider behavior matches the current feasibility document and official terms.
- Documentation distinguishes shipped behavior from roadmap scaffolding.
- Accessibility, loading, empty, and error states were considered for UI changes.

See `docs/testing/strategy.md` for the full test matrix and `SECURITY.md` for private
vulnerability reporting.

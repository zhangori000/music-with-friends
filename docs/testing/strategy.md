# Testing strategy

Status: the repository has automated coverage for the synthetic web/API slice. Live
authentication, persistence, browser E2E, and device E2E are roadmap work.

## Contract-first rule

For every behavior change:

1. Write the smallest failing behavior or contract test.
2. Run that narrow test and observe the intended failure.
3. Implement the minimum change.
4. Refactor only while the test remains green.
5. Run the relevant wider suite before review.

Provider policy is behavior. A change to what a provider may supply must update the
capability contract and `docs/product/provider-feasibility.md` before adapter code.

## Current test layers

| Layer | Protects | Command |
| --- | --- | --- |
| Domain unit | aggregation, duration quality, visibility, provider policy | `npm run test:unit` |
| Contract | `/api/v1` schemas and provider capabilities | `npm run test:unit` |
| Integration | route behavior without a network server | `npm run test:unit` |
| Architecture | keeps `src/domain` independent of frameworks and SDKs | `npm run test:architecture` |
| Production smoke | builds vinext and requests the emitted Worker | `npm run test:smoke` |
| Static checks | root and mobile TypeScript | `npm run typecheck`; `npm run mobile:typecheck` |
| Mobile bundle | Expo can export an iOS bundle | `npm run mobile:export` |

The current smoke test exercises generated HTML and the API through the built Worker;
it is not a real-browser test. The Expo export proves bundling, not behavior on a
simulator or phone.

## Required local gate

```bash
npm run verify
```

`npm run verify` runs lint, root typechecking, all current tests, mobile typechecking,
and the iOS export. Keep live Spotify, ListenBrainz, and other external APIs out of CI;
inject deterministic `fetch` fakes and test error, timeout, malformed-data, and
rate-limit responses.

## Tests required before the live-data phase

- Supabase local-stack integration tests for migrations and authentication.
- pgTAP tests for every RLS policy, including negative cross-user/group cases.
- OAuth callback tests for state, PKCE, replay, disconnect, and token refresh.
- Idempotent ingestion tests covering duplicates, retries, and partial provider data.
- Playwright smoke flows against a public preview deployment.
- `jest-expo` plus React Native Testing Library for mobile components.
- Maestro login, dashboard, disconnect, and deletion smoke flows on a release build.

Supabase documents its [local and pgTAP test workflow](https://supabase.com/docs/guides/local-development/cli/testing-and-linting), Next.js documents its [supported testing tools](https://nextjs.org/docs/app/guides/testing), and Expo documents both [Jest testing](https://docs.expo.dev/develop/unit-testing/) and [Maestro E2E workflows](https://docs.expo.dev/eas/workflows/examples/e2e-tests/).

Coverage is diagnostic, not the release goal. Authorization, provider-policy, data
deletion, and money-moving behavior require explicit positive and negative tests even
if line coverage is already high.

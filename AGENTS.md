# Project working agreement

- Read `docs/product/provider-feasibility.md` before changing provider behavior.
- Never derive listening metrics from Spotify Web API evidence. Spotify Web API data is
  direct display and link-out only. A user-selected account-data export may be analyzed
  locally through the `manual-import` boundary; do not upload or socially redistribute
  it without a separate policy, consent, authorization, and deletion decision.
- “Minutes listened” may sum `actualDurationMs`; never substitute catalog track duration.
- Write the failing behavior or contract test before implementation, then run the narrow test and the relevant wider suite.
- Keep `src/domain` free of React, Next.js, database, and provider SDK imports.
- Web and iPhone clients consume the versioned `/api/v1` contract.
- Keep provider tokens server-side and encrypted. No secrets in public or `EXPO_PUBLIC_*` variables.
- Distributed queues, ads, and AI are documented seams, not MVP dependencies.

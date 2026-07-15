# Advertising seam

**Status: future design scaffolding only. The app contains no ad SDK, placement,
tracking pixel, attribution provider, auction code, or personalized-ad profile.**

The MVP optimizes trust and product usefulness, not ad inventory. A future `AdProvider`
port may expose named placements while its default `NoAds` adapter returns nothing.
Domain, authorization, listening, and provider adapters must never import an ad SDK.

## Non-negotiable boundaries

- No provider tokens, raw listening history, friend/group graph, email, or private
  profile data goes to an advertiser.
- Ads cannot alter rankings, visibility, provider eligibility, or API responses.
- No ad may appear beside provider artwork or metadata until that provider's current
  terms and branding rules have been reviewed in writing.
- Contextual ads are preferred. Cross-app/site tracking requires a separate legal and
  product decision, explicit consent where required, and Apple's App Tracking
  Transparency flow.
- Paid removal must not reduce privacy or core account safety for free users.

Apple documents [App Tracking Transparency](https://developer.apple.com/documentation/apptrackingtransparency) and required [App privacy details](https://developer.apple.com/app-store/app-privacy-details/). If a future web deployment uses Vercel Hobby, any ad revenue makes the deployment commercial and requires a paid plan under [Vercel's plan terms](https://vercel.com/pricing).

## Activation gates

1. Provider-policy, privacy, App Store, tax, and age-related reviews are complete.
2. A consent model separates necessary analytics, contextual ads, and tracking.
3. Data-flow and deletion tests prove the ad adapter cannot receive restricted fields.
4. Remote kill switch, placement frequency caps, accessibility checks, and revenue/cost
   telemetry are ready.
5. A small opt-in experiment shows value without harming retention, latency, or trust.

Traffic or infrastructure cost alone does not activate advertising.

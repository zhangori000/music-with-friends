import { describe, expect, it } from "vitest";
import {
  assertDerivedAnalyticsAllowed,
  providerCapabilities,
} from "../../src/domain/providers/capabilities";

describe("provider analytics policy", () => {
  it("blocks Spotify evidence from derived analytics", () => {
    expect(providerCapabilities.spotify.derivedAnalytics).toBe("blocked");
    expect(() => assertDerivedAnalyticsAllowed("spotify")).toThrow(
      /Spotify.*derived analytics.*blocked/i,
    );
  });

  it("allows synthetic, consented history, and local user imports", () => {
    expect(() => assertDerivedAnalyticsAllowed("demo")).not.toThrow();
    expect(() => assertDerivedAnalyticsAllowed("listenbrainz")).not.toThrow();
    expect(() => assertDerivedAnalyticsAllowed("manual-import")).not.toThrow();
  });

  it("requires review for provider sources without analytics approval", () => {
    expect(() => assertDerivedAnalyticsAllowed("apple-music")).toThrow(
      /apple-music derived analytics are policy-review/i,
    );
  });
});

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

  it("allows synthetic demo evidence to exercise the analytics domain", () => {
    expect(() => assertDerivedAnalyticsAllowed("demo")).not.toThrow();
    expect(() => assertDerivedAnalyticsAllowed("listenbrainz")).not.toThrow();
  });

  it("requires review for non-Spotify sources without analytics approval", () => {
    expect(() => assertDerivedAnalyticsAllowed("manual-import")).toThrow(
      /manual-import derived analytics are policy-review/i,
    );
  });
});

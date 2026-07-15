import { describe, expect, it } from "vitest";
import { aggregateListeningEvidence } from "../../src/domain/listening/aggregate";
import type { ListeningEvidence } from "../../src/domain/listening/model";

const range = {
  start: new Date("2026-07-01T00:00:00.000Z"),
  end: new Date("2026-08-01T00:00:00.000Z"),
};

function evidence(
  overrides: Partial<ListeningEvidence> = {},
): ListeningEvidence {
  return {
    id: "listen-1",
    source: "listenbrainz",
    kind: "timestamped-listen",
    playedAt: "2026-07-14T08:00:00.000Z",
    actualDurationMs: 180_000,
    track: {
      id: "track-1",
      title: "Satellite Heart",
      artist: "Juniper Vale",
      durationMs: 240_000,
      externalUrl: "https://open.spotify.com/track/example",
    },
    context: {
      kind: "playlist",
      id: "playlist-1",
      name: "Night Drive",
      quality: "verified",
    },
    ...overrides,
  };
}

describe("aggregateListeningEvidence", () => {
  it("uses actual listened duration and never substitutes full track duration", () => {
    const result = aggregateListeningEvidence(
      [
        evidence(),
        evidence({
          id: "listen-2",
          actualDurationMs: null,
          track: {
            id: "track-2",
            title: "Skipped Song",
            artist: "Juniper Vale",
            durationMs: 600_000,
          },
        }),
      ],
      range,
    );

    expect(result.playCount).toBe(2);
    expect(result.listenedMinutes.value).toBe(3);
    expect(result.listenedMinutes.quality).toBe("partial");
    expect(result.listenedMinutes.coverageRatio).toBe(0.5);
  });

  it("is idempotent for duplicate evidence ids", () => {
    const duplicate = evidence();
    const result = aggregateListeningEvidence([duplicate, duplicate], range);

    expect(result.playCount).toBe(1);
    expect(result.listenedMinutes.value).toBe(3);
  });

  it("uses a half-open time range", () => {
    const result = aggregateListeningEvidence(
      [
        evidence({ id: "at-start", playedAt: range.start.toISOString() }),
        evidence({ id: "at-end", playedAt: range.end.toISOString() }),
        evidence({ id: "no-time", playedAt: null }),
      ],
      range,
    );

    expect(result.playCount).toBe(1);
  });

  it("returns deterministic top artist and playlist results", () => {
    const result = aggregateListeningEvidence(
      [
        evidence({ id: "a-1" }),
        evidence({
          id: "b-1",
          track: { id: "track-b", title: "North", artist: "Aster" },
          context: {
            kind: "playlist",
            id: "playlist-b",
            name: "Focus",
            quality: "verified",
          },
        }),
      ],
      range,
    );

    expect(result.topArtist).toEqual({ name: "Aster", playCount: 1 });
    expect(result.topPlaylist).toEqual({ name: "Focus", playCount: 1 });
  });

  it("does not promote inferred playlist membership into a played-from metric", () => {
    const result = aggregateListeningEvidence(
      [
        evidence({
          context: {
            kind: "playlist",
            id: "playlist-guess",
            name: "Maybe Focus",
            quality: "inferred",
          },
        }),
      ],
      range,
    );

    expect(result.topPlaylist).toBeNull();
  });

  it("prefers a larger play count over insertion order", () => {
    const result = aggregateListeningEvidence(
      [
        evidence({ id: "first" }),
        evidence({
          id: "second",
          track: { id: "aster-1", title: "North", artist: "Aster" },
        }),
        evidence({
          id: "third",
          track: { id: "aster-2", title: "South", artist: "Aster" },
        }),
      ],
      range,
    );

    expect(result.topArtist).toEqual({ name: "Aster", playCount: 2 });
  });

  it("reports empty and duration-free evidence without inventing metrics", () => {
    const empty = aggregateListeningEvidence([], range);
    const durationFree = aggregateListeningEvidence(
      [
        evidence({
          actualDurationMs: null,
          context: {
            kind: "album",
            id: "album-1",
            name: "Orbit",
            quality: "verified",
          },
        }),
      ],
      range,
    );

    expect(empty).toMatchObject({
      playCount: 0,
      uniqueTrackCount: 0,
      listenedMinutes: {
        value: 0,
        quality: "unavailable",
        coverageRatio: 0,
      },
      topArtist: null,
      topPlaylist: null,
    });
    expect(durationFree.listenedMinutes).toEqual({
      value: 0,
      quality: "unavailable",
      coverageRatio: 0,
    });
    expect(durationFree.topPlaylist).toBeNull();
  });

  it("rejects an invalid range", () => {
    expect(() =>
      aggregateListeningEvidence([], {
        start: new Date("2026-08-01T00:00:00.000Z"),
        end: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ).toThrow(/start.*before.*end/i);
  });

  it.each([
    [new Date("invalid"), range.end],
    [range.start, new Date("invalid")],
  ])("rejects a range with a non-finite boundary", (start, end) => {
    expect(() => aggregateListeningEvidence([], { start, end })).toThrow(
      /start.*before.*end/i,
    );
  });

  it("rejects an invalid played-at timestamp", () => {
    expect(() =>
      aggregateListeningEvidence(
        [evidence({ playedAt: "not-an-iso-timestamp" })],
        range,
      ),
    ).toThrow(/invalid playedAt timestamp/i);
  });

  it.each([-1, Number.POSITIVE_INFINITY])(
    "rejects invalid actual duration %s",
    (actualDurationMs) => {
      expect(() =>
        aggregateListeningEvidence([evidence({ actualDurationMs })], range),
      ).toThrow(/invalid actual duration/i);
    },
  );

  it("refuses evidence from a provider that prohibits derived analytics", () => {
    expect(() =>
      aggregateListeningEvidence([evidence({ source: "spotify" })], range),
    ).toThrow(/Spotify.*derived analytics.*blocked/i);
  });
});

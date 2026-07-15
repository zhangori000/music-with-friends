import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { analyzeImportedHistory } from "../../src/application/import/analyze-imported-history";
import {
  mergeImportedHistory,
  parseSpotifyHistoryJson,
} from "../../src/infrastructure/import/spotify-history";

const extendedPlay = {
  ts: "2026-07-14T20:04:12Z",
  username: "private-user",
  platform: "iOS 20.1",
  ms_played: 184_200,
  conn_country: "US",
  ip_addr: "203.0.113.42",
  master_metadata_track_name: "Midnight City",
  master_metadata_album_artist_name: "M83",
  master_metadata_album_album_name: "Hurry Up, We're Dreaming",
  spotify_track_uri: "spotify:track:3cl6BsTDeeGRbgug5TXrvg",
  reason_start: "trackdone",
  reason_end: "trackdone",
  shuffle: false,
  skipped: false,
  offline: false,
  incognito_mode: false,
};

describe("Spotify history import", () => {
  it("ships a parseable sample that exercises the public import flow", async () => {
    const sample = await readFile(
      new URL(
        "../../public/samples/spotify-history-sample.json",
        import.meta.url,
      ),
      "utf8",
    );
    const result = parseSpotifyHistoryJson(sample, "spotify-history-sample.json");

    expect(result.acceptedCount).toBeGreaterThan(10);
    expect(result.rejectedCount).toBe(0);
  });

  it("converts Extended Streaming History into minimal listening evidence", () => {
    const result = parseSpotifyHistoryJson(
      JSON.stringify([
        extendedPlay,
        {
          ...extendedPlay,
          spotify_track_uri: null,
          master_metadata_track_name: null,
          master_metadata_album_artist_name: null,
          episode_name: "A podcast episode",
          episode_show_name: "A podcast",
          spotify_episode_uri: "spotify:episode:episode-id",
        },
      ]),
      "Streaming_History_Audio_2026_0.json",
    );

    expect(result).toMatchObject({
      acceptedCount: 1,
      ignoredCount: 1,
      rejectedCount: 0,
    });
    expect(result.evidence[0]).toMatchObject({
      source: "manual-import",
      kind: "user-import",
      playedAt: "2026-07-14T20:04:12.000Z",
      actualDurationMs: 184_200,
      track: {
        id: "3cl6BsTDeeGRbgug5TXrvg",
        title: "Midnight City",
        artist: "M83",
        externalUrl:
          "https://open.spotify.com/track/3cl6BsTDeeGRbgug5TXrvg",
      },
      context: null,
    });

    const serialized = JSON.stringify(result.evidence);
    expect(serialized).not.toContain("private-user");
    expect(serialized).not.toContain("203.0.113.42");
    expect(serialized).not.toContain("iOS 20.1");
  });

  it("supports Spotify's legacy one-year history shape", () => {
    const result = parseSpotifyHistoryJson(
      JSON.stringify([
        {
          endTime: "2025-12-31 23:59",
          artistName: "Aster",
          trackName: "North",
          msPlayed: 91_500,
        },
      ]),
      "StreamingHistory_music_0.json",
    );

    expect(result.evidence[0]).toMatchObject({
      playedAt: "2025-12-31T23:59:00.000Z",
      actualDurationMs: 91_500,
      track: { title: "North", artist: "Aster", externalUrl: null },
    });
  });

  it("rejects malformed rows without throwing away valid rows", () => {
    const result = parseSpotifyHistoryJson(
      JSON.stringify([
        extendedPlay,
        { ...extendedPlay, ts: "not-a-date" },
        { ...extendedPlay, ms_played: -1 },
        { ...extendedPlay, master_metadata_album_artist_name: "" },
      ]),
      "history.json",
    );

    expect(result.acceptedCount).toBe(1);
    expect(result.rejectedCount).toBe(3);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "invalid_timestamp",
      "invalid_duration",
      "missing_music_metadata",
    ]);
  });

  it("keeps private-session history out of the local evidence store", () => {
    const result = parseSpotifyHistoryJson(
      JSON.stringify([{ ...extendedPlay, incognito_mode: true }]),
      "private-history.json",
    );

    expect(result).toMatchObject({
      acceptedCount: 0,
      ignoredCount: 1,
      rejectedCount: 0,
    });
  });

  it("fails clearly when a selected file is not a JSON array", () => {
    expect(() => parseSpotifyHistoryJson("{", "broken.json")).toThrow(
      /broken\.json.*valid JSON/i,
    );
    expect(() => parseSpotifyHistoryJson("{}", "object.json")).toThrow(
      /object\.json.*array/i,
    );
  });

  it("deduplicates overlapping files using a stable event identity", () => {
    const first = parseSpotifyHistoryJson(
      JSON.stringify([extendedPlay]),
      "part-0.json",
    );
    const second = parseSpotifyHistoryJson(
      JSON.stringify([extendedPlay]),
      "part-1.json",
    );
    const merged = mergeImportedHistory([first.evidence, second.evidence]);

    expect(merged.evidence).toHaveLength(1);
    expect(merged.duplicateCount).toBe(1);
    expect(first.evidence[0]?.id).toBe(second.evidence[0]?.id);
  });

  it("deduplicates the same play across legacy minute and Extended timestamps", () => {
    const legacy = parseSpotifyHistoryJson(
      JSON.stringify([
        {
          endTime: "2026-07-14 20:04",
          artistName: "M83",
          trackName: "Midnight City",
          msPlayed: 184_200,
        },
      ]),
      "StreamingHistory_music_0.json",
    );
    const extended = parseSpotifyHistoryJson(
      JSON.stringify([extendedPlay]),
      "Streaming_History_Audio_2026_0.json",
    );

    const merged = mergeImportedHistory([
      legacy.evidence,
      extended.evidence,
    ]);

    expect(merged.duplicateCount).toBe(1);
    expect(merged.evidence).toHaveLength(1);
    expect(merged.evidence[0]).toMatchObject({
      playedAt: "2026-07-14T20:04:12.000Z",
      track: {
        externalUrl:
          "https://open.spotify.com/track/3cl6BsTDeeGRbgug5TXrvg",
      },
    });
  });

  it("keeps distinct Extended plays that end within the same minute", () => {
    const imported = parseSpotifyHistoryJson(
      JSON.stringify([
        extendedPlay,
        { ...extendedPlay, ts: "2026-07-14T20:04:45Z" },
      ]),
      "Streaming_History_Audio_2026_0.json",
    );
    const merged = mergeImportedHistory([imported.evidence]);

    expect(merged.duplicateCount).toBe(0);
    expect(merged.evidence).toHaveLength(2);
    expect(merged.evidence[0]?.id).not.toBe(merged.evidence[1]?.id);
  });

  it("answers arbitrary ranges with exact minutes and the latest 20 plays", () => {
    const rows = Array.from({ length: 24 }, (_, index) => ({
      ...extendedPlay,
      ts: `2026-07-${String(index + 1).padStart(2, "0")}T20:04:12Z`,
      ms_played: 60_000,
      master_metadata_album_artist_name: index < 13 ? "M83" : "Aster",
      master_metadata_track_name: `Track ${index + 1}`,
      spotify_track_uri: null,
    }));
    const imported = parseSpotifyHistoryJson(JSON.stringify(rows), "history.json");
    const view = analyzeImportedHistory(imported.evidence, {
      start: new Date("2026-07-04T00:00:00.000Z"),
      end: new Date("2026-07-24T23:00:00.000Z"),
    });

    expect(view.stats).toMatchObject({
      playCount: 21,
      uniqueTrackCount: 21,
      listenedMinutes: { value: 21, quality: "exact", coverageRatio: 1 },
      topArtist: { name: "Aster", playCount: 11 },
      topPlaylist: null,
    });
    expect(view.recent).toHaveLength(20);
    expect(view.recent[0]?.track.title).toBe("Track 24");
    expect(view.recent.at(-1)?.track.title).toBe("Track 5");
  });

  it("can exclude short plays without changing the imported source data", () => {
    const imported = parseSpotifyHistoryJson(
      JSON.stringify([
        { ...extendedPlay, ts: "2026-07-14T20:04:12Z", ms_played: 29_999 },
        { ...extendedPlay, ts: "2026-07-14T20:05:12Z", ms_played: 30_000 },
      ]),
      "history.json",
    );
    const view = analyzeImportedHistory(
      imported.evidence,
      {
        start: new Date("2026-07-14T00:00:00.000Z"),
        end: new Date("2026-07-15T00:00:00.000Z"),
      },
      { minimumDurationMs: 30_000 },
    );

    expect(imported.evidence).toHaveLength(2);
    expect(view.stats.playCount).toBe(1);
    expect(view.stats.listenedMinutes.value).toBe(0.5);
  });
});

import { bench, describe } from "vitest";
import { parseSpotifyHistoryJson } from "../src/infrastructure/import/spotify-history";

const historyJson = JSON.stringify(
  Array.from({ length: 50_000 }, (_, index) => ({
    ts: new Date(Date.UTC(2020, 0, 1) + index * 240_000).toISOString(),
    ms_played: 180_000 + (index % 60_000),
    master_metadata_track_name: `Track ${index % 2_000}`,
    master_metadata_album_artist_name: `Artist ${index % 300}`,
    master_metadata_album_album_name: `Album ${index % 600}`,
    spotify_track_uri: `spotify:track:${String(index % 2_000).padStart(22, "0")}`,
    skipped: false,
    offline: false,
    incognito_mode: false,
  })),
);

describe("Spotify history import", () => {
  bench("parses and minimizes 50,000 exported streams", () => {
    parseSpotifyHistoryJson(historyJson, "benchmark.json");
  });
});

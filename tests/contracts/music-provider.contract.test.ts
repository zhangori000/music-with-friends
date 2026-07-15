import { describe, expect, it, vi } from "vitest";
import { DemoMusicProvider } from "../../src/infrastructure/providers/demo-music-provider";
import { SpotifyMusicProvider } from "../../src/infrastructure/providers/spotify-music-provider";
import { ListenBrainzMusicProvider } from "../../src/infrastructure/providers/listenbrainz-music-provider";

describe.each([
  ["demo", new DemoMusicProvider()],
  ["spotify", new SpotifyMusicProvider({ accessToken: "fixture-token" })],
  ["listenbrainz", new ListenBrainzMusicProvider({ username: "fixture-user" })],
])("%s music-provider contract", (_name, provider) => {
  it("declares capabilities before data is requested", () => {
    expect(provider.capabilities.id).toBe(provider.id);
    expect(provider.capabilities.recentItems.limit).toBeGreaterThanOrEqual(20);
  });
});

describe("demo adapter contract", () => {
  it("honors positive, zero, and negative recent-item limits", async () => {
    const provider = new DemoMusicProvider();

    await expect(provider.getRecentItems()).resolves.toHaveLength(1);
    await expect(provider.getRecentItems(0)).resolves.toHaveLength(0);
    await expect(provider.getRecentItems(-10)).resolves.toHaveLength(0);
  });
});

describe("Spotify adapter contract", () => {
  it("cannot claim exact duration or arbitrary analytics ranges", () => {
    const provider = new SpotifyMusicProvider({ accessToken: "fixture-token" });

    expect(provider.capabilities.actualListenDuration).toBe("none");
    expect(provider.capabilities.arbitraryTimeRanges).toBe(false);
    expect(provider.capabilities.derivedAnalytics).toBe("blocked");
  });

  it("clamps limits and maps recent snapshots without claiming duration", async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({
          items: [
            {
              played_at: "2026-07-14T20:00:00.000Z",
              context: {
                type: "playlist",
                uri: "spotify:playlist:night-drive",
              },
              track: {
                id: "track-1",
                name: "Midnight City",
                duration_ms: 244_000,
                external_urls: {
                  spotify: "https://open.spotify.com/track/track-1",
                },
                artists: [{ name: "M83" }, { name: "Guest" }],
              },
            },
            {
              played_at: "2026-07-14T19:00:00.000Z",
              context: { type: "album" },
              track: {
                id: "track-2",
                name: "North",
                duration_ms: 180_000,
                external_urls: {
                  spotify: "https://open.spotify.com/track/track-2",
                },
                artists: [{ name: "Aster" }],
              },
            },
            {
              played_at: "2026-07-14T18:00:00.000Z",
              context: null,
              track: {
                id: "track-3",
                name: "Satellite Heart",
                duration_ms: 200_000,
                external_urls: {
                  spotify: "https://open.spotify.com/track/track-3",
                },
                artists: [{ name: "Juniper Vale" }],
              },
            },
          ],
      }),
    );
    const provider = new SpotifyMusicProvider({
      accessToken: "secret-token",
      fetch: request,
    });

    const items = await provider.getRecentItems(99.8);
    await provider.getRecentItems(0);

    expect(request.mock.calls[0]).toEqual([
      "https://api.spotify.com/v1/me/player/recently-played?limit=50",
      { headers: { authorization: "Bearer secret-token" } },
    ]);
    expect(request.mock.calls[1]?.[0]).toContain("limit=1");
    expect(items).toMatchObject([
      {
        id: "spotify:track-1:2026-07-14T20:00:00.000Z",
        actualDurationMs: null,
        track: { artist: "M83, Guest" },
        context: {
          kind: "playlist",
          id: "spotify:playlist:night-drive",
          name: "playlist",
        },
      },
      {
        context: { kind: "unknown", id: null, name: "album" },
      },
      { context: null },
    ]);
  });

  it("surfaces HTTP and payload failures at the adapter boundary", async () => {
    const unavailable = new SpotifyMusicProvider({
      accessToken: "fixture-token",
      fetch: async () => new Response(null, { status: 429 }),
    });
    const malformed = new SpotifyMusicProvider({
      accessToken: "fixture-token",
      fetch: async () =>
        Response.json({ items: [{ played_at: "missing-track" }] }),
    });

    await expect(unavailable.getRecentItems()).rejects.toThrow(
      /failed with 429/i,
    );
    await expect(malformed.getRecentItems()).rejects.toThrow();
  });
});

describe("ListenBrainz capability contract", () => {
  it("keeps exact duration conditional and upstream history public", async () => {
    const { providerCapabilities } = await import(
      "../../src/domain/providers/capabilities"
    );

    expect(providerCapabilities.listenbrainz.actualListenDuration).toBe("optional");
    expect(providerCapabilities.listenbrainz.recentItems.limit).toBe(1_000);
    expect(providerCapabilities.listenbrainz.backgroundSync).toBe("user-token");
  });

  it("maps optional actual duration without inventing playlist context", async () => {
    const request = async () =>
      Response.json({
        payload: {
          listens: [
            {
              listened_at: 1_784_070_000,
              recording_msid: "recording-1",
              track_metadata: {
                artist_name: "Juniper Vale",
                track_name: "Satellite Heart",
                additional_info: {
                  duration_ms: 240_000,
                  duration_played: 171,
                },
              },
            },
          ],
        },
      });
    const provider = new ListenBrainzMusicProvider({
      username: "ori",
      fetch: request,
    });

    const [item] = await provider.getRecentItems(20);
    expect(item.actualDurationMs).toBe(171_000);
    expect(item.track.durationMs).toBe(240_000);
    expect(item.context).toBeNull();
  });

  it("authenticates, clamps limits, and applies documented identity fallbacks", async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({
          payload: {
            listens: [
              {
                listened_at: 1_784_070_000,
                recording_msid: "lower-priority-msid",
                track_metadata: {
                  artist_name: "Juniper Vale",
                  track_name: "Satellite Heart",
                  additional_info: {
                    recording_mbid: "recording-mbid",
                    origin_url:
                      "https://musicbrainz.org/recording/recording-mbid",
                  },
                },
              },
              {
                listened_at: 1_784_069_000,
                track_metadata: {
                  artist_name: "Aster",
                  track_name: "North",
                  additional_info: { origin_url: "not-a-url" },
                },
              },
            ],
          },
      }),
    );
    const provider = new ListenBrainzMusicProvider({
      username: "ori/listener",
      userToken: "user-token",
      fetch: request,
    });

    const items = await provider.getRecentItems(5_000.9);
    await provider.getRecentItems(0);

    expect(request.mock.calls[0]).toEqual([
      "https://api.listenbrainz.org/1/user/ori%2Flistener/listens?count=1000",
      {
        headers: {
          accept: "application/json",
          authorization: "Token user-token",
        },
      },
    ]);
    expect(request.mock.calls[1]?.[0]).toContain("count=1");
    expect(items).toMatchObject([
      {
        id: "listenbrainz:recording-mbid:1784070000",
        actualDurationMs: null,
        track: {
          id: "recording-mbid",
          durationMs: null,
          externalUrl: "https://musicbrainz.org/recording/recording-mbid",
        },
      },
      {
        id: "listenbrainz:Aster:North:1784069000",
        track: { id: "Aster:North", externalUrl: null },
      },
    ]);
  });

  it("surfaces HTTP and payload failures at the adapter boundary", async () => {
    const unavailable = new ListenBrainzMusicProvider({
      username: "ori",
      fetch: async () => new Response(null, { status: 503 }),
    });
    const malformed = new ListenBrainzMusicProvider({
      username: "ori",
      fetch: async () => Response.json({ payload: { listens: [{}] } }),
    });

    await expect(unavailable.getRecentItems()).rejects.toThrow(
      /failed with 503/i,
    );
    await expect(malformed.getRecentItems()).rejects.toThrow();
  });
});

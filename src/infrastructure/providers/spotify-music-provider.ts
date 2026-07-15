import { z } from "zod";
import type { MusicProvider } from "../../application/ports/music-provider";
import type { ListeningEvidence } from "../../domain/listening/model";
import { providerCapabilities } from "../../domain/providers/capabilities";
import { parseTrustedProviderLink } from "./provider-link";

const spotifyExternalUrlSchema = z.string().transform((value, context) => {
  const trustedUrl = parseTrustedProviderLink("spotify-external", value);
  if (trustedUrl) return trustedUrl;

  context.addIssue({
    code: "custom",
    message: "Spotify returned an untrusted external URL.",
  });
  return z.NEVER;
});

const recentlyPlayedSchema = z.object({
  items: z.array(
    z.object({
      played_at: z.string(),
      context: z
        .object({ type: z.string(), uri: z.string().nullable().optional() })
        .nullable(),
      track: z.object({
        id: z.string(),
        name: z.string(),
        duration_ms: z.number(),
        external_urls: z.object({ spotify: spotifyExternalUrlSchema }),
        artists: z.array(z.object({ name: z.string() })).min(1),
      }),
    }),
  ),
});

type SpotifyMusicProviderOptions = {
  accessToken: string;
  fetch?: typeof fetch;
};

export class SpotifyMusicProvider implements MusicProvider {
  readonly id = "spotify" as const;
  readonly capabilities = providerCapabilities.spotify;
  private readonly accessToken: string;
  private readonly request: typeof fetch;

  constructor(options: SpotifyMusicProviderOptions) {
    this.accessToken = options.accessToken;
    this.request = options.fetch ?? fetch;
  }

  async getRecentItems(limit = 20): Promise<readonly ListeningEvidence[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const response = await this.request(
      `https://api.spotify.com/v1/me/player/recently-played?limit=${safeLimit}`,
      { headers: { authorization: `Bearer ${this.accessToken}` } },
    );
    if (!response.ok) {
      throw new Error(`Spotify recently played failed with ${response.status}.`);
    }

    const payload = recentlyPlayedSchema.parse(await response.json());
    return payload.items.map((item) => ({
      id: `spotify:${item.track.id}:${item.played_at}`,
      source: "spotify",
      kind: "recent-snapshot",
      playedAt: item.played_at,
      actualDurationMs: null,
      track: {
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map((artist) => artist.name).join(", "),
        durationMs: item.track.duration_ms,
        externalUrl: item.track.external_urls.spotify,
      },
      context: item.context
        ? {
            kind: item.context.type === "playlist" ? "playlist" : "unknown",
            id: item.context.uri ?? null,
            name: item.context.type,
            quality: "verified",
          }
        : null,
    }));
  }
}

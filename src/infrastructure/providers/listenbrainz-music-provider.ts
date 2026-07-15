import { z } from "zod";
import type { MusicProvider } from "../../application/ports/music-provider";
import type { ListeningEvidence } from "../../domain/listening/model";
import { providerCapabilities } from "../../domain/providers/capabilities";

const listenBrainzResponseSchema = z.object({
  payload: z.object({
    listens: z.array(
      z.object({
        listened_at: z.number().int().nonnegative(),
        recording_msid: z.string().optional(),
        track_metadata: z.object({
          artist_name: z.string().min(1),
          track_name: z.string().min(1),
          additional_info: z
            .object({
              recording_mbid: z.string().optional(),
              duration_ms: z.number().nonnegative().optional(),
              duration_played: z.number().nonnegative().optional(),
              origin_url: z.string().optional(),
            })
            .passthrough()
            .optional(),
        }),
      }),
    ),
  }),
});

type ListenBrainzMusicProviderOptions = {
  username: string;
  userToken?: string;
  fetch?: typeof fetch;
};

export class ListenBrainzMusicProvider implements MusicProvider {
  readonly id = "listenbrainz" as const;
  readonly capabilities = providerCapabilities.listenbrainz;
  private readonly username: string;
  private readonly userToken?: string;
  private readonly request: typeof fetch;

  constructor(options: ListenBrainzMusicProviderOptions) {
    this.username = options.username;
    this.userToken = options.userToken;
    this.request = options.fetch ?? fetch;
  }

  async getRecentItems(limit = 20): Promise<readonly ListeningEvidence[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 1_000);
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.userToken) headers.authorization = `Token ${this.userToken}`;

    const response = await this.request(
      `https://api.listenbrainz.org/1/user/${encodeURIComponent(this.username)}/listens?count=${safeLimit}`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`ListenBrainz history failed with ${response.status}.`);
    }

    const payload = listenBrainzResponseSchema.parse(await response.json());
    return payload.payload.listens.map((listen) => {
      const info = listen.track_metadata.additional_info;
      const trackId =
        info?.recording_mbid ??
        listen.recording_msid ??
        `${listen.track_metadata.artist_name}:${listen.track_metadata.track_name}`;
      const externalUrl = info?.origin_url;

      return {
        id: `listenbrainz:${trackId}:${listen.listened_at}`,
        source: "listenbrainz",
        kind: "timestamped-listen",
        playedAt: new Date(listen.listened_at * 1_000).toISOString(),
        actualDurationMs:
          info?.duration_played === undefined
            ? null
            : Math.round(info.duration_played * 1_000),
        track: {
          id: trackId,
          title: listen.track_metadata.track_name,
          artist: listen.track_metadata.artist_name,
          durationMs: info?.duration_ms ?? null,
          externalUrl:
            externalUrl && URL.canParse(externalUrl) ? externalUrl : null,
        },
        context: null,
      } satisfies ListeningEvidence;
    });
  }
}

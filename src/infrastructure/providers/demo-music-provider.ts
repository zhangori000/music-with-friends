import type { MusicProvider } from "../../application/ports/music-provider";
import type { ListeningEvidence } from "../../domain/listening/model";
import { providerCapabilities } from "../../domain/providers/capabilities";

export class DemoMusicProvider implements MusicProvider {
  readonly id = "demo" as const;
  readonly capabilities = providerCapabilities.demo;

  async getRecentItems(limit = 20): Promise<readonly ListeningEvidence[]> {
    return demoEvidence.slice(0, Math.max(0, limit));
  }
}

const demoEvidence: ListeningEvidence[] = [
  {
    id: "demo-listen-1",
    source: "demo",
    kind: "synthetic",
    playedAt: "2026-07-14T21:42:00.000Z",
    actualDurationMs: 198_000,
    track: {
      id: "demo-track-1",
      title: "Midnight City",
      artist: "M83",
      durationMs: 244_000,
      externalUrl: "https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt",
    },
    context: { kind: "playlist", id: "night-drive", name: "Night Drive" },
  },
];

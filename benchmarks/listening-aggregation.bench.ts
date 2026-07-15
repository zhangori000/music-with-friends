import { bench, describe } from "vitest";
import { aggregateListeningEvidence } from "../src/domain/listening/aggregate";
import type { ListeningEvidence } from "../src/domain/listening/model";

const start = new Date("2026-01-01T00:00:00.000Z");
const range = { start, end: new Date("2027-01-01T00:00:00.000Z") };

const evidence: ListeningEvidence[] = Array.from({ length: 10_000 }, (_, index) => ({
  id: `listen-${index}`,
  source: "demo",
  kind: "synthetic",
  playedAt: new Date(start.getTime() + index * 30_000).toISOString(),
  actualDurationMs: index % 7 === 0 ? null : 180_000,
  track: {
    id: `track-${index % 500}`,
    title: `Track ${index % 500}`,
    artist: `Artist ${index % 100}`,
  },
  context: {
    kind: "playlist",
    id: `playlist-${index % 20}`,
    name: `Playlist ${index % 20}`,
    quality: "verified",
  },
}));

describe("listening aggregation", () => {
  bench("aggregates 10,000 normalized events", () => {
    aggregateListeningEvidence(evidence, range);
  });
});

import { assertDerivedAnalyticsAllowed } from "../providers/capabilities";
import type {
  ListeningEvidence,
  ListeningStats,
  TimeRange,
} from "./model";

function topCount(
  values: string[],
): { name: string; playCount: number } | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let top: { name: string; playCount: number } | null = null;
  for (const [name, playCount] of counts) {
    if (
      !top ||
      playCount > top.playCount ||
      (playCount === top.playCount && name.localeCompare(top.name) < 0)
    ) {
      top = { name, playCount };
    }
  }

  return top;
}

export function aggregateListeningEvidence(
  evidence: readonly ListeningEvidence[],
  range: TimeRange,
): ListeningStats {
  const start = range.start.getTime();
  const end = range.end.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error("The range start must be before its end.");
  }

  for (const item of evidence) {
    assertDerivedAnalyticsAllowed(item.source);
  }

  const unique = new Map(evidence.map((item) => [item.id, item]));
  const inRange = [...unique.values()].filter((item) => {
    if (!item.playedAt) return false;
    const playedAt = Date.parse(item.playedAt);
    if (!Number.isFinite(playedAt)) {
      throw new Error(`Evidence ${item.id} has an invalid playedAt timestamp.`);
    }
    return playedAt >= start && playedAt < end;
  });

  let durationCoverage = 0;
  let totalDurationMs = 0;
  for (const item of inRange) {
    if (item.actualDurationMs !== null) {
      if (item.actualDurationMs < 0 || !Number.isFinite(item.actualDurationMs)) {
        throw new Error(`Evidence ${item.id} has an invalid actual duration.`);
      }
      durationCoverage += 1;
      totalDurationMs += item.actualDurationMs;
    }
  }

  const coverageRatio = inRange.length
    ? durationCoverage / inRange.length
    : 0;
  const quality =
    durationCoverage === 0
      ? "unavailable"
      : durationCoverage === inRange.length
        ? "exact"
        : "partial";

  return {
    playCount: inRange.length,
    uniqueTrackCount: new Set(inRange.map((item) => item.track.id)).size,
    listenedMinutes: {
      value: Math.round((totalDurationMs / 60_000) * 10) / 10,
      quality,
      coverageRatio,
    },
    topArtist: topCount(inRange.map((item) => item.track.artist)),
    topPlaylist: topCount(
      inRange.flatMap((item) =>
        item.context?.kind === "playlist" &&
        item.context.quality === "verified"
          ? [item.context.name]
          : [],
      ),
    ),
  };
}

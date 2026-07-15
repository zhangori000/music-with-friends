import { aggregateListeningEvidence } from "../../domain/listening/aggregate";
import type {
  ListeningEvidence,
  ListeningStats,
  TimeRange,
} from "../../domain/listening/model";

export type ImportedHistoryView = {
  stats: ListeningStats;
  recent: readonly ListeningEvidence[];
};

export function analyzeImportedHistory(
  evidence: readonly ListeningEvidence[],
  range: TimeRange,
  options: { recentLimit?: number; minimumDurationMs?: number } = {},
): ImportedHistoryView {
  const recentLimit = Math.max(0, Math.trunc(options.recentLimit ?? 20));
  const minimumDurationMs = Math.max(0, options.minimumDurationMs ?? 0);
  const qualified = evidence.filter(
    (item) =>
      item.actualDurationMs === null || item.actualDurationMs >= minimumDurationMs,
  );
  const stats = aggregateListeningEvidence(qualified, range);
  const start = range.start.getTime();
  const end = range.end.getTime();
  const unique = new Map(qualified.map((item) => [item.id, item]));
  const recent = [...unique.values()]
    .filter((item) => {
      const playedAt = item.playedAt ? Date.parse(item.playedAt) : Number.NaN;
      return Number.isFinite(playedAt) && playedAt >= start && playedAt < end;
    })
    .sort((left, right) =>
      (right.playedAt ?? "").localeCompare(left.playedAt ?? ""),
    )
    .slice(0, recentLimit);

  return { stats, recent };
}

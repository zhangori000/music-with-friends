import type { ListeningEvidence } from "../../domain/listening/model";

export type SpotifyHistoryImportIssueCode =
  | "invalid_timestamp"
  | "invalid_duration"
  | "missing_music_metadata";

export type SpotifyHistoryImportIssue = {
  row: number;
  code: SpotifyHistoryImportIssueCode;
  message: string;
};

export type SpotifyHistoryImportResult = {
  evidence: readonly ListeningEvidence[];
  acceptedCount: number;
  ignoredCount: number;
  rejectedCount: number;
  issues: readonly SpotifyHistoryImportIssue[];
};

type JsonRecord = Record<string, unknown>;
type SpotifyHistoryFormat = "extended" | "legacy";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeLegacyTimestamp(value: string): string {
  const utcMinute = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(value);
  return utcMinute ? `${utcMinute[1]}T${utcMinute[2]}:00.000Z` : value;
}

function spotifyTrackId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^spotify:track:([A-Za-z0-9]{1,64})$/.exec(value)?.[1] ?? null;
}

function normalizedIdentityPart(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function stableHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ (code + index), 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

function importFailure(fileName: string, detail: string): Error {
  return new Error(`${fileName} ${detail}`);
}

export function parseSpotifyHistoryJson(
  json: string,
  fileName: string,
): SpotifyHistoryImportResult {
  let rows: unknown;
  try {
    rows = JSON.parse(json) as unknown;
  } catch {
    throw importFailure(fileName, "is not valid JSON.");
  }

  if (!Array.isArray(rows)) {
    throw importFailure(fileName, "must contain a JSON array.");
  }

  const evidence: ListeningEvidence[] = [];
  const issues: SpotifyHistoryImportIssue[] = [];
  let ignoredCount = 0;

  rows.forEach((row, rowIndex) => {
    const report = (
      code: SpotifyHistoryImportIssueCode,
      message: string,
    ) => issues.push({ row: rowIndex + 1, code, message });

    if (!isRecord(row)) {
      report("missing_music_metadata", "The row is not a history record.");
      return;
    }

    const isExtended = "ms_played" in row || "spotify_track_uri" in row;
    const format: SpotifyHistoryFormat = isExtended ? "extended" : "legacy";
    if (isExtended && row.incognito_mode === true) {
      ignoredCount += 1;
      return;
    }
    const title = requiredText(
      isExtended ? row.master_metadata_track_name : row.trackName,
    );
    const artist = requiredText(
      isExtended ? row.master_metadata_album_artist_name : row.artistName,
    );

    if (!title && !artist && (row.episode_name || row.episodeName)) {
      ignoredCount += 1;
      return;
    }
    if (!title || !artist) {
      report(
        "missing_music_metadata",
        "The row does not contain both a music track and artist.",
      );
      return;
    }

    const rawTimestamp = requiredText(isExtended ? row.ts : row.endTime);
    const timestamp = rawTimestamp
      ? new Date(normalizeLegacyTimestamp(rawTimestamp))
      : new Date(Number.NaN);
    if (!Number.isFinite(timestamp.getTime())) {
      report("invalid_timestamp", "The row has an invalid end timestamp.");
      return;
    }

    const rawDuration = isExtended ? row.ms_played : row.msPlayed;
    if (
      typeof rawDuration !== "number" ||
      !Number.isFinite(rawDuration) ||
      rawDuration < 0
    ) {
      report("invalid_duration", "The row has an invalid listened duration.");
      return;
    }

    const playedAt = timestamp.toISOString();
    const actualDurationMs = Math.round(rawDuration);
    const providerTrackId = spotifyTrackId(row.spotify_track_uri);
    const identity = [
      playedAt,
      normalizedIdentityPart(artist),
      normalizedIdentityPart(title),
      actualDurationMs,
    ].join("\u0000");

    evidence.push({
      id: `manual-import:${format}:${stableHash(identity)}`,
      source: "manual-import",
      kind: "user-import",
      playedAt,
      actualDurationMs,
      track: {
        id:
          providerTrackId ??
          `imported:${stableHash(
            `${normalizedIdentityPart(artist)}\u0000${normalizedIdentityPart(title)}`,
          )}`,
        title,
        artist,
        durationMs: null,
        externalUrl: providerTrackId
          ? `https://open.spotify.com/track/${providerTrackId}`
          : null,
      },
      // Spotify's history export does not identify the playlist context.
      context: null,
    });
  });

  return {
    evidence,
    acceptedCount: evidence.length,
    ignoredCount,
    rejectedCount: issues.length,
    issues,
  };
}

function informationScore(item: ListeningEvidence): number {
  return Number(Boolean(item.track.externalUrl)) + Number(Boolean(item.track.durationMs));
}

function historyFormat(item: ListeningEvidence): SpotifyHistoryFormat | null {
  const match = /^manual-import:(extended|legacy):/.exec(item.id);
  return (match?.[1] as SpotifyHistoryFormat | undefined) ?? null;
}

function crossFormatIdentity(item: ListeningEvidence): string | null {
  if (!item.playedAt || item.actualDurationMs === null) return null;
  const playedAt = Date.parse(item.playedAt);
  if (!Number.isFinite(playedAt)) return null;

  return [
    Math.floor(playedAt / 60_000),
    normalizedIdentityPart(item.track.artist),
    normalizedIdentityPart(item.track.title),
    Math.round(item.actualDurationMs),
  ].join("\u0000");
}

export function mergeImportedHistory(
  chunks: readonly (readonly ListeningEvidence[])[],
): { evidence: readonly ListeningEvidence[]; duplicateCount: number } {
  const unique = new Map<string, ListeningEvidence>();
  let duplicateCount = 0;

  for (const chunk of chunks) {
    for (const item of chunk) {
      const existing = unique.get(item.id);
      if (!existing) {
        unique.set(item.id, item);
        continue;
      }

      duplicateCount += 1;
      if (informationScore(item) > informationScore(existing)) {
        unique.set(item.id, item);
      }
    }
  }

  const extendedKeys = new Set<string>();
  for (const item of unique.values()) {
    if (historyFormat(item) !== "extended") continue;
    const identity = crossFormatIdentity(item);
    if (identity) extendedKeys.add(identity);
  }

  for (const [id, item] of unique) {
    if (historyFormat(item) !== "legacy") continue;
    const identity = crossFormatIdentity(item);
    if (identity && extendedKeys.has(identity)) {
      unique.delete(id);
      duplicateCount += 1;
    }
  }

  return {
    evidence: [...unique.values()].sort((left, right) => {
      const byTime = (left.playedAt ?? "").localeCompare(right.playedAt ?? "");
      return byTime || left.id.localeCompare(right.id);
    }),
    duplicateCount,
  };
}

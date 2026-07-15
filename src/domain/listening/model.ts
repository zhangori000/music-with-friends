import type { MusicSource } from "../providers/capabilities";

export type ListeningEvidenceKind =
  | "timestamped-listen"
  | "recent-snapshot"
  | "user-import"
  | "synthetic";

export type ListeningTrack = {
  id: string;
  title: string;
  artist: string;
  durationMs?: number | null;
  externalUrl?: string | null;
};

export type ListeningContext = {
  kind: "playlist" | "album" | "artist" | "unknown";
  id: string | null;
  name: string;
};

export type ListeningEvidence = {
  id: string;
  source: MusicSource;
  kind: ListeningEvidenceKind;
  playedAt: string | null;
  actualDurationMs: number | null;
  track: ListeningTrack;
  context: ListeningContext | null;
};

export type TimeRange = {
  start: Date;
  end: Date;
};

export type ListeningStats = {
  playCount: number;
  uniqueTrackCount: number;
  listenedMinutes: {
    value: number;
    quality: "exact" | "partial" | "unavailable";
    coverageRatio: number;
  };
  topArtist: { name: string; playCount: number } | null;
  topPlaylist: { name: string; playCount: number } | null;
};

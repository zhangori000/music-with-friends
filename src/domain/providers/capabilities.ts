export type MusicSource =
  | "spotify"
  | "listenbrainz"
  | "apple-music"
  | "youtube-music"
  | "manual-import"
  | "demo";

export type ProviderCapabilities = {
  id: MusicSource;
  recentItems: {
    supported: boolean;
    limit: number;
    mode: "none" | "recent-snapshot" | "timestamped-history";
  };
  topItems: "none" | "provider-affinity" | "play-counts";
  actualListenDuration: "none" | "optional" | "exact";
  arbitraryTimeRanges: boolean;
  playlistWrite: boolean;
  backgroundSync:
    | "none"
    | "device-token"
    | "refresh-token"
    | "user-token"
    | "daily-archive";
  derivedAnalytics: "allowed" | "blocked" | "policy-review";
  socialRedistribution: "allowed" | "explicit-consent" | "policy-review" | "blocked";
};

export const providerCapabilities = {
  spotify: {
    id: "spotify",
    recentItems: { supported: true, limit: 50, mode: "recent-snapshot" },
    topItems: "provider-affinity",
    actualListenDuration: "none",
    arbitraryTimeRanges: false,
    playlistWrite: true,
    backgroundSync: "refresh-token",
    derivedAnalytics: "blocked",
    socialRedistribution: "policy-review",
  },
  listenbrainz: {
    id: "listenbrainz",
    recentItems: { supported: true, limit: 1_000, mode: "timestamped-history" },
    topItems: "play-counts",
    actualListenDuration: "optional",
    arbitraryTimeRanges: true,
    playlistWrite: false,
    backgroundSync: "user-token",
    derivedAnalytics: "allowed",
    socialRedistribution: "explicit-consent",
  },
  "apple-music": {
    id: "apple-music",
    recentItems: { supported: true, limit: 30, mode: "recent-snapshot" },
    topItems: "provider-affinity",
    actualListenDuration: "none",
    arbitraryTimeRanges: false,
    playlistWrite: true,
    backgroundSync: "device-token",
    derivedAnalytics: "policy-review",
    socialRedistribution: "policy-review",
  },
  "youtube-music": {
    id: "youtube-music",
    recentItems: { supported: false, limit: 0, mode: "none" },
    topItems: "none",
    actualListenDuration: "none",
    arbitraryTimeRanges: false,
    playlistWrite: true,
    backgroundSync: "none",
    derivedAnalytics: "blocked",
    socialRedistribution: "blocked",
  },
  "manual-import": {
    id: "manual-import",
    recentItems: { supported: true, limit: 10_000, mode: "timestamped-history" },
    topItems: "play-counts",
    actualListenDuration: "optional",
    arbitraryTimeRanges: true,
    playlistWrite: false,
    backgroundSync: "none",
    // This source is a user-selected file processed locally, not Spotify Web API data.
    derivedAnalytics: "allowed",
    socialRedistribution: "explicit-consent",
  },
  demo: {
    id: "demo",
    recentItems: { supported: true, limit: 100, mode: "timestamped-history" },
    topItems: "play-counts",
    actualListenDuration: "exact",
    arbitraryTimeRanges: true,
    playlistWrite: false,
    backgroundSync: "none",
    derivedAnalytics: "allowed",
    socialRedistribution: "allowed",
  },
} satisfies Record<MusicSource, ProviderCapabilities>;

export function assertDerivedAnalyticsAllowed(source: MusicSource): void {
  const status = providerCapabilities[source].derivedAnalytics;
  if (status !== "allowed") {
    const label = source === "spotify" ? "Spotify" : source;
    throw new Error(
      `${label} derived analytics are ${status}; use direct provider data only.`,
    );
  }
}

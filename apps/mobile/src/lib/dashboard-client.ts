export type RangePreset = "this_week" | "this_month" | "this_year" | "all_time";

export type DashboardSnapshot = {
  meta: { range: RangePreset; dataMode: "synthetic" | "live" };
  group: { id: string; name: string; description: string; memberCount: number };
  summary: {
    playCount: number;
    uniqueTrackCount: number;
    listenedMinutes: { value: number; quality: "exact" | "partial" | "unavailable" };
    topArtist: { name: string; playCount: number } | null;
    topPlaylist: { name: string; playCount: number } | null;
  };
  members: Array<{
    id: string;
    displayName: string;
    initials: string;
    accent: string;
    listenedMinutes: number;
    playCount: number;
    topArtist: string;
  }>;
  recent: Array<{
    id: string;
    title: string;
    artist: string;
    playedBy: string;
    externalUrl: string;
    accent: string;
  }>;
};

export function buildDashboardUrl(baseUrl: string, range: RangePreset): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/api/v1/demo/groups/friday-loop?range=${range}`;
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function isDashboardResponse(value: unknown): value is DashboardSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DashboardSnapshot>;
  return Boolean(
    candidate.meta?.range &&
      candidate.group?.id &&
      candidate.summary?.listenedMinutes &&
      Array.isArray(candidate.members) &&
      Array.isArray(candidate.recent),
  );
}

export async function fetchDashboard(
  baseUrl: string,
  range: RangePreset,
  request: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<DashboardSnapshot> {
  const response = await request(buildDashboardUrl(baseUrl, range), {
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Dashboard request failed with ${response.status}.`);
  }
  const body: unknown = await response.json();
  if (!isDashboardResponse(body)) {
    throw new Error("Dashboard response did not match the v1 contract.");
  }
  return body;
}

import type {
  DashboardResponse,
  RangePreset,
} from "../../contracts/dashboard";

type RangeData = Pick<DashboardResponse, "summary" | "members">;

const people = [
  {
    id: "maya",
    displayName: "Maya",
    handle: "@mayaafterdark",
    initials: "M",
    accent: "coral",
    topArtist: "Charli xcx",
  },
  {
    id: "ori",
    displayName: "Orien",
    handle: "@ori",
    initials: "O",
    accent: "lime",
    topArtist: "M83",
  },
  {
    id: "dev",
    displayName: "Dev",
    handle: "@devtones",
    initials: "D",
    accent: "blue",
    topArtist: "Kaytranada",
  },
  {
    id: "lena",
    displayName: "Lena",
    handle: "@lenaloops",
    initials: "L",
    accent: "violet",
    topArtist: "Chappell Roan",
  },
] as const;

const rangeValues = {
  this_week: {
    minutes: [612, 547, 461, 343],
    plays: [164, 149, 121, 92],
    uniqueTracks: 287,
    topArtist: { name: "Charli xcx", playCount: 37 },
    topPlaylist: { name: "Kitchen Disco", playCount: 58 },
  },
  this_month: {
    minutes: [2_348, 2_191, 1_972, 1_613],
    plays: [622, 584, 516, 422],
    uniqueTracks: 914,
    topArtist: { name: "M83", playCount: 121 },
    topPlaylist: { name: "Night Drive", playCount: 193 },
  },
  this_year: {
    minutes: [18_924, 17_610, 16_432, 14_276],
    plays: [5_014, 4_673, 4_392, 3_806],
    uniqueTracks: 4_287,
    topArtist: { name: "Kaytranada", playCount: 684 },
    topPlaylist: { name: "Kitchen Disco", playCount: 1_009 },
  },
  all_time: {
    minutes: [58_301, 52_471, 49_630, 42_086],
    plays: [15_492, 13_971, 13_142, 11_109],
    uniqueTracks: 12_804,
    topArtist: { name: "M83", playCount: 1_743 },
    topPlaylist: { name: "Night Drive", playCount: 2_801 },
  },
} satisfies Record<
  RangePreset,
  {
    minutes: number[];
    plays: number[];
    uniqueTracks: number;
    topArtist: { name: string; playCount: number };
    topPlaylist: { name: string; playCount: number };
  }
>;

const recent: DashboardResponse["recent"] = [
  ["Midnight City", "M83", "Maya", "2026-07-14T23:48:00.000Z", "coral"],
  ["Redbone", "Childish Gambino", "Orien", "2026-07-14T23:39:00.000Z", "lime"],
  ["Lite Spots", "KAYTRANADA", "Dev", "2026-07-14T23:21:00.000Z", "blue"],
  ["Pink Pony Club", "Chappell Roan", "Lena", "2026-07-14T23:02:00.000Z", "violet"],
  ["BIRDS OF A FEATHER", "Billie Eilish", "Maya", "2026-07-14T22:47:00.000Z", "gold"],
  ["Texas Sun", "Khruangbin & Leon Bridges", "Orien", "2026-07-14T22:33:00.000Z", "orange"],
  ["360", "Charli xcx", "Dev", "2026-07-14T22:16:00.000Z", "green"],
  ["Good Days", "SZA", "Lena", "2026-07-14T21:58:00.000Z", "pink"],
].map(([title, artist, playedBy, playedAt, accent], index) => ({
  id: `recent-${index + 1}`,
  title,
  artist,
  playedAt,
  playedBy,
  source: "demo" as const,
  externalUrl: `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`,
  accent,
}));

function buildRangeData(range: RangePreset): RangeData {
  const values = rangeValues[range];
  const members = people.map((person, index) => ({
    ...person,
    listenedMinutes: values.minutes[index],
    playCount: values.plays[index],
    source: "demo" as const,
  }));

  return {
    members,
    summary: {
      playCount: values.plays.reduce((total, value) => total + value, 0),
      uniqueTrackCount: values.uniqueTracks,
      listenedMinutes: {
        value: values.minutes.reduce((total, value) => total + value, 0),
        quality: "exact",
        coverageRatio: 1,
      },
      topArtist: values.topArtist,
      topPlaylist: values.topPlaylist,
    },
  };
}

export function getDemoDashboard(range: RangePreset): DashboardResponse {
  return {
    meta: {
      apiVersion: "v1",
      generatedAt: "2026-07-14T23:50:00.000Z",
      range,
      dataMode: "synthetic",
      dataPolicy:
        "Synthetic data demonstrates analytics. Spotify data is limited to direct recent and top-item views.",
    },
    group: {
      id: "friday-loop",
      name: "The Friday Loop",
      description: "Four friends, one very opinionated listening room.",
      visibility: "friends",
      memberCount: people.length,
    },
    ...buildRangeData(range),
    recent,
    providerNotice: {
      title: "Why this preview uses demo history",
      body:
        "Spotify permits recent tracks and its own top-item affinity, but blocks apps from calculating new listening metrics. The production analytics adapter will use consented, policy-compatible listen history.",
      href: "/docs#provider-boundaries",
    },
  };
}

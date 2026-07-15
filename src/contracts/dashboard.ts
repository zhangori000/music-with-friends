import { z } from "zod";

export const rangePresetSchema = z.enum([
  "this_week",
  "this_month",
  "this_year",
  "all_time",
]);

export type RangePreset = z.infer<typeof rangePresetSchema>;

const countedNameSchema = z.object({
  name: z.string().min(1),
  playCount: z.number().int().nonnegative(),
});

export const dashboardResponseSchema = z.object({
  meta: z.object({
    apiVersion: z.literal("v1"),
    generatedAt: z.string().datetime(),
    range: rangePresetSchema,
    dataMode: z.enum(["synthetic", "live"]),
    dataPolicy: z.string().min(1),
  }),
  group: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    visibility: z.enum(["private", "friends", "groups", "public"]),
    memberCount: z.number().int().positive(),
  }),
  summary: z.object({
    playCount: z.number().int().nonnegative(),
    uniqueTrackCount: z.number().int().nonnegative(),
    listenedMinutes: z.object({
      value: z.number().nonnegative(),
      quality: z.enum(["exact", "partial", "unavailable"]),
      coverageRatio: z.number().min(0).max(1),
    }),
    topArtist: countedNameSchema.nullable(),
    topPlaylist: countedNameSchema.nullable(),
  }),
  members: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      handle: z.string(),
      initials: z.string().min(1).max(3),
      accent: z.string(),
      listenedMinutes: z.number().nonnegative(),
      playCount: z.number().int().nonnegative(),
      topArtist: z.string(),
      source: z.enum(["demo", "listenbrainz", "spotify-direct"]),
    }),
  ),
  recent: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      artist: z.string(),
      playedAt: z.string().datetime(),
      playedBy: z.string(),
      source: z.enum(["demo", "listenbrainz", "spotify-direct"]),
      externalUrl: z.string().url(),
      accent: z.string(),
    }),
  ),
  providerNotice: z.object({
    title: z.string(),
    body: z.string(),
    href: z.string(),
  }),
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

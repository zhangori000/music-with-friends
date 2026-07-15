import { describe, expect, it, vi } from "vitest";
import {
  buildDashboardUrl,
  fetchDashboard,
  formatMinutes,
} from "../../apps/mobile/src/lib/dashboard-client";

describe("mobile dashboard client", () => {
  it("builds the same versioned endpoint used by the web client", () => {
    expect(
      buildDashboardUrl("https://example.test/", "this_month"),
    ).toBe(
      "https://example.test/api/v1/demo/groups/friday-loop?range=this_month",
    );
  });

  it("formats duration without pretending partial minutes are exact seconds", () => {
    expect(formatMinutes(612)).toBe("10h 12m");
    expect(formatMinutes(42)).toBe("42m");
  });

  it("returns a valid dashboard and forwards cancellation to the request", async () => {
    const dashboard = {
      meta: { range: "this_week", dataMode: "synthetic" },
      group: {
        id: "friday-loop",
        name: "Friday Loop",
        description: "Shared discoveries",
        memberCount: 2,
      },
      summary: {
        playCount: 3,
        uniqueTrackCount: 2,
        listenedMinutes: { value: 8, quality: "exact" },
        topArtist: { name: "M83", playCount: 2 },
        topPlaylist: null,
      },
      members: [],
      recent: [],
    };
    const request = vi.fn(async () => Response.json(dashboard));
    const controller = new AbortController();

    await expect(
      fetchDashboard(
        "https://example.test",
        "this_week",
        request,
        controller.signal,
      ),
    ).resolves.toEqual(dashboard);
    expect(request).toHaveBeenCalledWith(
      "https://example.test/api/v1/demo/groups/friday-loop?range=this_week",
      {
        headers: { accept: "application/json" },
        signal: controller.signal,
      },
    );
  });

  it("reports an unsuccessful HTTP status before parsing a body", async () => {
    const request = vi.fn(async () => new Response(null, { status: 503 }));

    await expect(
      fetchDashboard("https://example.test", "this_week", request),
    ).rejects.toThrow(/failed with 503/i);
  });

  it("rejects a malformed API response at the client boundary", async () => {
    const request = vi.fn(async () =>
      Response.json({ group: { name: "missing everything else" } }),
    );

    await expect(
      fetchDashboard("https://example.test", "this_week", request),
    ).rejects.toThrow(/dashboard response/i);
  });

  it.each([
    ["a null body", null],
    ["a primitive body", "not-a-dashboard"],
    ["missing metadata", {}],
    ["missing group identity", { meta: { range: "this_week" } }],
    [
      "missing summary",
      { meta: { range: "this_week" }, group: { id: "friday-loop" } },
    ],
    [
      "non-array members",
      {
        meta: { range: "this_week" },
        group: { id: "friday-loop" },
        summary: { listenedMinutes: { value: 0, quality: "unavailable" } },
        members: {},
      },
    ],
    [
      "non-array recent items",
      {
        meta: { range: "this_week" },
        group: { id: "friday-loop" },
        summary: { listenedMinutes: { value: 0, quality: "unavailable" } },
        members: [],
        recent: {},
      },
    ],
  ])("rejects %s", async (_case, body) => {
    const request = vi.fn(async () => Response.json(body));

    await expect(
      fetchDashboard("https://example.test", "this_week", request),
    ).rejects.toThrow(/dashboard response/i);
  });
});

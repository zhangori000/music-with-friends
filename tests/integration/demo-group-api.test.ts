import { describe, expect, it } from "vitest";
import { dashboardResponseSchema } from "../../src/contracts/dashboard";
import { GET } from "../../app/api/v1/demo/groups/[slug]/route";

function context(slug = "friday-loop") {
  return { params: Promise.resolve({ slug }) };
}

describe("GET /api/v1/demo/groups/:slug", () => {
  it("returns a versioned, schema-valid dashboard", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/v1/demo/groups/friday-loop?range=this_week",
      ),
      context(),
    );
    const body = dashboardResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/public/);
    expect(body.meta.apiVersion).toBe("v1");
    expect(body.group.visibility).toBe("friends");
    expect(body.recent).toHaveLength(8);
  });

  it("changes the read model when the requested range changes", async () => {
    const [week, year] = await Promise.all([
      GET(
        new Request(
          "http://localhost/api/v1/demo/groups/friday-loop?range=this_week",
        ),
        context(),
      ),
      GET(
        new Request(
          "http://localhost/api/v1/demo/groups/friday-loop?range=this_year",
        ),
        context(),
      ),
    ]);

    const weekBody = dashboardResponseSchema.parse(await week.json());
    const yearBody = dashboardResponseSchema.parse(await year.json());
    expect(yearBody.summary.listenedMinutes.value).toBeGreaterThan(
      weekBody.summary.listenedMinutes.value,
    );
  });

  it("defaults to this week when the range is omitted", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/demo/groups/friday-loop"),
      context(),
    );
    const body = dashboardResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.meta.range).toBe("this_week");
  });

  it("rejects unknown ranges and groups", async () => {
    const invalidRange = await GET(
      new Request(
        "http://localhost/api/v1/demo/groups/friday-loop?range=previous_fortnight",
      ),
      context(),
    );
    const missingGroup = await GET(
      new Request("http://localhost/api/v1/demo/groups/nope"),
      context("nope"),
    );

    expect(invalidRange.status).toBe(400);
    expect(missingGroup.status).toBe(404);
  });
});

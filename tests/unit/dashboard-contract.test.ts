import { describe, expect, it } from "vitest";
import {
  dashboardResponseSchema,
  rangePresetSchema,
} from "../../src/contracts/dashboard";
import { getDemoDashboard } from "../../src/application/demo/get-demo-dashboard";

describe("dashboard contract", () => {
  it("enumerates the supported MVP ranges", () => {
    expect(rangePresetSchema.options).toEqual([
      "this_week",
      "this_month",
      "this_year",
      "all_time",
    ]);
  });

  it("keeps source provenance and quality visible", () => {
    const dashboard = dashboardResponseSchema.parse(
      getDemoDashboard("this_week"),
    );

    expect(dashboard.meta.dataMode).toBe("synthetic");
    expect(dashboard.summary.listenedMinutes.quality).toBe("exact");
    expect(dashboard.recent.every((item) => item.source === "demo")).toBe(true);
  });
});

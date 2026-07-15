import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_BYTES,
  formatListeningTime,
} from "../../src/application/import/import-history-presentation";

describe("import history presentation", () => {
  it("keeps the synchronous import batch within a defensible browser budget", () => {
    expect(MAX_IMPORT_BYTES).toBe(25 * 1024 * 1024);
  });

  it.each([
    [0, "0m"],
    [0.5, "30s"],
    [1.5, "1m 30s"],
    [61.5, "1h 1m 30s"],
  ])("renders %s minutes without rounding away listened time", (minutes, expected) => {
    expect(formatListeningTime(minutes)).toBe(expected);
  });
});

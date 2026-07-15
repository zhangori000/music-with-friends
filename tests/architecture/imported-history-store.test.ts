import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("browser-local import persistence", () => {
  it("merges new chunks against current IndexedDB state in one write transaction", async () => {
    const client = await readFile(
      "app/import/import-history-client.tsx",
      "utf8",
    );
    const store = await readFile(
      "src/infrastructure/browser/imported-history-store.ts",
      "utf8",
    );

    expect(client).toContain("mergeImportedHistoryIntoStore(chunks)");
    expect(client).not.toMatch(/mergeImportedHistory\(\[evidence,/);
    expect(client).toContain("25 MB per batch");
    expect(client).not.toContain("250 MB");
    expect(store).toMatch(
      /export async function mergeImportedHistoryIntoStore[\s\S]*transaction\(EVIDENCE_STORE, "readwrite"\)/,
    );
    expect(store).toMatch(
      /mergeImportedHistoryIntoStore[\s\S]*transaction\.objectStore\(EVIDENCE_STORE\)[\s\S]*store\.getAll\(\)/,
    );
    expect(store).toContain("store.delete(item.id)");
    expect(store).toContain("if (incomingIds.has(item.id)) store.put(item)");
  });
});

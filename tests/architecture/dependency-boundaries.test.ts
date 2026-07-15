import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(root, entry.name);
      return entry.isDirectory()
        ? sourceFiles(path)
        : Promise.resolve([path]);
    }),
  );
  return nested.flat().filter((path) => [".ts", ".tsx"].includes(extname(path)));
}

describe("architecture fitness functions", () => {
  it("keeps the domain independent of frameworks and provider SDKs", async () => {
    const files = await sourceFiles(join(process.cwd(), "src/domain"));
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (/from ["'](?:next|react|drizzle-orm|@supabase|spotify)/.test(source)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const context = { waitUntil() {}, passThroughOnException() {} };

test("renders the complete social listening dashboard", async () => {
  const app = await worker();
  const response = await app.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    env,
    context,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Music with Friends/);
  assert.match(html, /The Friday Loop/);
  assert.match(html, /Synthetic demo/);
  assert.match(html, /Open in Spotify/);
  assert.match(html, /og\.png/);
  assert.match(html, /Why this preview uses demo history/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Codex is working/);
});

test("serves the same versioned API contract the iPhone app consumes", async () => {
  const app = await worker();
  const response = await app.fetch(
    new Request(
      "http://localhost/api/v1/demo/groups/friday-loop?range=this_month",
      { headers: { accept: "application/json" } },
    ),
    env,
    context,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.meta.apiVersion, "v1");
  assert.equal(body.meta.range, "this_month");
  assert.equal(body.group.id, "friday-loop");
  assert.equal(body.recent.length, 8);
});

test("renders the private browser-side Spotify history import flow", async () => {
  const app = await worker();
  const response = await app.fetch(
    new Request("http://localhost/import", {
      headers: { accept: "text/html" },
    }),
    env,
    context,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  const csp = response.headers.get("content-security-policy") ?? "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /img-src 'self' data:/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/);
  assert.match(response.headers.get("permissions-policy") ?? "", /microphone=\(\)/);
  assert.match(response.headers.get("permissions-policy") ?? "", /geolocation=\(\)/);
  assert.match(html, /Turn your Spotify history into answers/);
  assert.match(html, /https:\/\/www\.spotify\.com\/account\/privacy\//);
  assert.match(html, /Request Extended Streaming History/);
  assert.match(html, /Choose JSON files/);
  assert.match(html, /Files stay on this device/);
  assert.match(html, /Top playlist/);
  assert.match(html, /Spotify.*export does not include playlist context/);
});

test("removes every disposable starter artifact", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

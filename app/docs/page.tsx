import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Product and architecture notes",
  description: "The evidence, boundaries, and decisions behind Music with Friends.",
};

export default function DocsPage() {
  return (
    <main className="docs-page">
      <Link className="brand" href="/"><span className="record-mark" aria-hidden="true"><span /></span><span>Music with Friends</span></Link>
      <div className="docs-hero"><span className="eyebrow">Build notes · July 2026</span><h1>Honest data first.<br />Architecture second.</h1><p>The social product is straightforward. Provider rights and evidence quality are the hard system boundary.</p></div>

      <section className="docs-section" id="provider-boundaries">
        <span className="docs-number">01</span>
        <div><h2>Provider boundaries</h2><p>Our app account is independent from music accounts. Each adapter declares what it can retrieve, what can be derived, and whether background sync or social display is permitted.</p>
          <div className="docs-table" role="table" aria-label="Provider capability summary">
            <div className="docs-table-row docs-table-head" role="row"><span>Provider</span><span>History</span><span>Analytics</span><span>Role</span></div>
            <div className="docs-table-row" role="row"><strong id="spotify">Spotify</strong><span>Recent snapshot</span><span>Derived metrics blocked</span><span>Direct view + link-out</span></div>
            <div className="docs-table-row" role="row"><strong>ListenBrainz</strong><span>Timestamped, public</span><span>Counts; duration optional</span><span>MVP ingestion</span></div>
            <div className="docs-table-row" role="row"><strong>Apple Music</strong><span>Recent snapshot</span><span>No exact ranges/minutes</span><span>Future discovery</span></div>
            <div className="docs-table-row" role="row"><strong>YouTube Music</strong><span>No official history API</span><span>Derived metrics blocked</span><span>Playlist action only</span></div>
          </div>
          <p className="docs-citations">Primary sources: <a href="https://developer.spotify.com/policy">Spotify Developer Policy</a>, <a href="https://developer.spotify.com/documentation/web-api/reference/get-recently-played">Recently Played</a>, <a href="https://listenbrainz.readthedocs.io/en/latest/users/api/core.html">ListenBrainz Core API</a>, and <a href="https://listenbrainz.org/terms-of-service/">ListenBrainz terms</a>.</p>
        </div>
      </section>

      <section className="docs-section"><span className="docs-number">02</span><div><h2>One API, two clients</h2><p>The Next.js web client and Expo iPhone client consume the same versioned <code>/api/v1</code> contract. The domain owns privacy, ranges, and evidence quality; HTTP, Postgres, Spotify, and ListenBrainz are adapters.</p><pre>{`Web ─────┐\n          ├── /api/v1 ── application ── domain\niPhone ──┘                    │\n                    provider + storage adapters`}</pre></div></section>

      <section className="docs-section"><span className="docs-number">03</span><div><h2>No distributed EDA yet</h2><p>For a close-friends beta, a modular monolith plus an idempotent job table is faster, cheaper, and easier to recover. Domain events stay in-process. We add a queue only when backlog, independent retries, or isolation becomes measurable—not because “events” sound scalable.</p></div></section>

      <section className="docs-section"><span className="docs-number">04</span><div><h2>Test from the contract inward</h2><p>Unit tests protect time windows, duration quality, deduplication, and privacy. Provider contract tests prevent capability inflation. Integration tests exercise the HTTP schema; smoke tests boot the production worker. Real OAuth and database adapters require sandbox integration tests before activation.</p></div></section>

      <Link className="button button-primary docs-back" href="/">Return to the listening room</Link>
    </main>
  );
}

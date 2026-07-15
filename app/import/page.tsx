import type { Metadata } from "next";
import Link from "next/link";
import { ImportHistoryClient } from "./import-history-client";

export const metadata: Metadata = {
  title: "Import Spotify history — Music with Friends",
  description:
    "Analyze your Spotify Extended Streaming History privately in your browser.",
};

export default function ImportHistoryPage() {
  return (
    <div className="site-shell import-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Music with Friends home">
          <span className="record-mark" aria-hidden="true"><span /></span>
          <span>Music with Friends</span>
        </Link>
        <nav className="topnav" aria-label="Primary navigation">
          <Link href="/">Demo room</Link>
          <Link href="/docs">Architecture</Link>
        </nav>
      </header>

      <main className="import-page">
        <header className="import-hero">
          <span className="eyebrow">Your data · your browser</span>
          <h1>Turn your Spotify history into answers.</h1>
          <p>
            Choose the JSON files from Spotify&apos;s Extended Streaming History
            export. The raw files never leave this device; only the minimal
            normalized history is saved in this browser.
          </p>
          <p className="import-request-link">
            No export yet?{" "}
            <a
              href="https://www.spotify.com/account/privacy/"
              target="_blank"
              rel="noreferrer"
            >
              Request Extended Streaming History ↗
            </a>
            , then unzip the download and select its JSON parts below.
          </p>
        </header>
        <ImportHistoryClient />
      </main>

      <footer>
        <span>Music with Friends · local history lab</span>
        <span>No raw history upload.</span>
      </footer>
    </div>
  );
}

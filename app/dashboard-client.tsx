"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  dashboardResponseSchema,
  type DashboardResponse,
  type RangePreset,
} from "@/src/contracts/dashboard";

const rangeOptions: ReadonlyArray<{ id: RangePreset; label: string }> = [
  { id: "this_week", label: "Week" },
  { id: "this_month", label: "Month" },
  { id: "this_year", label: "Year" },
  { id: "all_time", label: "All time" },
];

const number = new Intl.NumberFormat("en-US");

function duration(minutes: number): string {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours ? `${number.format(hours)}h ${remainder}m` : `${remainder}m`;
}

function relativeTime(index: number): string {
  return index === 0 ? "2m ago" : `${index * 7 + 4}m ago`;
}

export function DashboardClient({
  initialDashboard,
}: {
  initialDashboard: DashboardResponse;
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [selectedMember, setSelectedMember] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const selectedName = dashboard.members.find(
    (member) => member.id === selectedMember,
  )?.displayName;
  const recent = selectedName
    ? dashboard.recent.filter((item) => item.playedBy === selectedName)
    : dashboard.recent;

  async function selectRange(range: RangePreset) {
    if (range === dashboard.meta.range || isLoading) return;
    setIsLoading(true);
    setStatus(`Loading ${range.replaceAll("_", " ")}…`);
    try {
      const response = await fetch(
        `/api/v1/demo/groups/friday-loop?range=${range}`,
      );
      if (!response.ok) throw new Error("Dashboard request failed");
      setDashboard(dashboardResponseSchema.parse(await response.json()));
      setStatus(`${range.replaceAll("_", " ")} loaded.`);
    } catch {
      setStatus("Could not change the range. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function shareGroup() {
    const shareData = {
      title: dashboard.group.name,
      text: "See what our listening group has on repeat.",
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setStatus("Share sheet opened.");
      } else {
        await navigator.clipboard.writeText(shareData.url);
        setStatus("Group link copied.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setStatus("Sharing is unavailable in this browser.");
      }
    }
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Music with Friends home">
          <span className="record-mark" aria-hidden="true"><span /></span>
          <span>Music with Friends</span>
        </a>
        <nav className="topnav" aria-label="Primary navigation">
          <Link href="/import">Import history</Link>
          <a href="/docs">Architecture</a>
          <Link href="/api/v1/demo/groups/friday-loop?range=this_week">API</Link>
          <button className="button button-ghost" onClick={() => dialogRef.current?.showModal()}>
            Connect source
          </button>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="group-title">
          <div className="hero-copy">
            <div className="eyebrow-row">
              <span className="eyebrow">Listening room · 04</span>
              <span className="privacy-pill"><span aria-hidden="true">●</span> Friends only</span>
            </div>
            <h1 id="group-title">{dashboard.group.name}</h1>
            <p>{dashboard.group.description}</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={shareGroup}>Share group</button>
              <a className="text-link" href="#recent">See what’s playing <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className="hero-collage" aria-label="Four group members">
            {dashboard.members.map((member, index) => (
              <button
                className={`portrait portrait-${member.accent}`}
                key={member.id}
                onClick={() => setSelectedMember(member.id)}
                aria-label={`Show ${member.displayName}'s recent listening`}
                aria-pressed={selectedMember === member.id}
                style={{ transform: `rotate(${[-5, 3, -2, 6][index]}deg)` }}
              >
                <span>{member.initials}</span>
                <small>{member.displayName}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="control-row" aria-label="Dashboard controls">
          <div className="range-tabs" role="group" aria-label="Listening range">
            {rangeOptions.map((option) => (
              <button
                key={option.id}
                className={dashboard.meta.range === option.id ? "active" : ""}
                aria-pressed={dashboard.meta.range === option.id}
                onClick={() => selectRange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="demo-pill"><span aria-hidden="true">◆</span> Synthetic demo</span>
          <span className="sr-only" role="status" aria-live="polite">{status}</span>
        </section>

        <section className={`stats-grid ${isLoading ? "is-loading" : ""}`} aria-label="Group summary" aria-busy={isLoading}>
          <article className="stat stat-featured">
            <span>Time listened</span>
            <strong>{duration(dashboard.summary.listenedMinutes.value)}</strong>
            <small>{dashboard.summary.listenedMinutes.quality} duration coverage</small>
          </article>
          <article className="stat">
            <span>Track starts</span>
            <strong>{number.format(dashboard.summary.playCount)}</strong>
            <small>{number.format(dashboard.summary.uniqueTrackCount)} unique tracks</small>
          </article>
          <article className="stat">
            <span>Top artist</span>
            <strong className="stat-name">{dashboard.summary.topArtist?.name ?? "—"}</strong>
            <small>{number.format(dashboard.summary.topArtist?.playCount ?? 0)} listens</small>
          </article>
          <article className="stat">
            <span>Top playlist</span>
            <strong className="stat-name">{dashboard.summary.topPlaylist?.name ?? "—"}</strong>
            <small>{number.format(dashboard.summary.topPlaylist?.playCount ?? 0)} starts</small>
          </article>
        </section>

        <section className="dashboard-grid">
          <div className="members-panel">
            <div className="section-heading">
              <div><span className="eyebrow">The crew</span><h2>Who’s spinning</h2></div>
              <button className={`mini-filter ${selectedMember === "all" ? "active" : ""}`} onClick={() => setSelectedMember("all")}>All</button>
            </div>
            <div className="member-list">
              {dashboard.members.map((member, index) => (
                <button
                  className={`member-row ${selectedMember === member.id ? "selected" : ""}`}
                  key={member.id}
                  onClick={() => setSelectedMember(member.id)}
                  aria-pressed={selectedMember === member.id}
                >
                  <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className={`avatar avatar-${member.accent}`}>{member.initials}</span>
                  <span className="member-name"><strong>{member.displayName}</strong><small>{member.handle}</small></span>
                  <span className="member-top"><small>Top artist</small><strong>{member.topArtist}</strong></span>
                  <span className="member-minutes"><strong>{duration(member.listenedMinutes)}</strong><small>{number.format(member.playCount)} listens</small></span>
                </button>
              ))}
            </div>
          </div>

          <div className="recent-panel" id="recent">
            <div className="section-heading">
              <div><span className="eyebrow">Live shelf</span><h2>{selectedName ? `${selectedName} played` : "Recently played"}</h2></div>
              {selectedMember !== "all" && <button className="mini-filter" onClick={() => setSelectedMember("all")}>Clear</button>}
            </div>
            <ol className="track-list">
              {recent.map((track, index) => (
                <li key={track.id}>
                  <span className={`track-cover cover-${track.accent}`} aria-hidden="true"><span>{track.title.slice(0, 1)}</span></span>
                  <span className="track-copy"><strong>{track.title}</strong><small>{track.artist}</small></span>
                  <span className="track-who"><strong>{track.playedBy}</strong><small>{relativeTime(index)}</small></span>
                  <a className="spotify-link" href={track.externalUrl} target="_blank" rel="noreferrer" aria-label={`Open ${track.title} by ${track.artist} in Spotify`}>
                    Open in Spotify <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <aside className="policy-note" id="provider-boundaries">
          <span className="policy-index">A / 01</span>
          <div><span className="eyebrow">Provider boundary</span><h2>{dashboard.providerNotice.title}</h2><p>{dashboard.providerNotice.body}</p></div>
          <a className="button button-light" href="/docs#provider-boundaries">Read the decision</a>
        </aside>
      </main>

      <footer>
        <span>Music with Friends · policy-aware by design</span>
        <span>Data shown here is synthetic.</span>
      </footer>

      <dialog ref={dialogRef} className="source-dialog" aria-labelledby="source-dialog-title" onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}>
        <div className="dialog-card">
          <button className="dialog-close" onClick={() => dialogRef.current?.close()} aria-label="Close">×</button>
          <span className="eyebrow">Connection plan</span>
          <h2 id="source-dialog-title">Bring listening evidence, not assumptions.</h2>
          <p>ListenBrainz is the recommended analytics source for the private beta. Spotify can provide direct recent tracks and top-item affinity, but not derived statistics.</p>
          <div className="source-options">
            <Link href="/import" onClick={() => dialogRef.current?.close()}><strong>Spotify history export</strong><span>Exact minutes and arbitrary ranges · stays on this device</span><b>Import JSON →</b></Link>
            <a href="https://listenbrainz.org/add-data/" target="_blank" rel="noreferrer"><strong>ListenBrainz</strong><span>Timestamped history · public upstream</span><b>Recommended ↗</b></a>
            <a href="/docs#spotify"><strong>Spotify</strong><span>Recent 20 + provider top items</span><b>Read limits →</b></a>
          </div>
        </div>
      </dialog>
    </div>
  );
}

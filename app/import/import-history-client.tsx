"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeImportedHistory } from "@/src/application/import/analyze-imported-history";
import {
  formatListeningTime,
  MAX_IMPORT_BYTES,
} from "@/src/application/import/import-history-presentation";
import type { ListeningEvidence, TimeRange } from "@/src/domain/listening/model";
import {
  clearImportedHistory,
  loadImportedHistory,
  mergeImportedHistoryIntoStore,
} from "@/src/infrastructure/browser/imported-history-store";
import { parseSpotifyHistoryJson } from "@/src/infrastructure/import/spotify-history";

const THIRTY_SECONDS_MS = 30_000;
const number = new Intl.NumberFormat("en-US");
const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type RangeChoice = "all_time" | "this_week" | "this_month" | "this_year" | "custom";
type ImportPhase = "loading" | "ready" | "importing" | "clearing";
type ImportReport = {
  accepted: number;
  ignored: number;
  rejected: number;
  duplicates: number;
  files: number;
};
type HistoryInput = {
  name: string;
  text: () => Promise<string>;
};

const rangeOptions: ReadonlyArray<{ id: RangeChoice; label: string }> = [
  { id: "all_time", label: "All time" },
  { id: "this_week", label: "Week" },
  { id: "this_month", label: "Month" },
  { id: "this_year", label: "Year" },
  { id: "custom", label: "Custom" },
];

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDay(value: string, followingDay = false): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]) + Number(followingDay),
  );
  return Number.isFinite(date.getTime()) ? date : null;
}

function startOfThisWeek(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function chosenRange(
  choice: RangeChoice,
  customStart: string,
  customEnd: string,
  now: Date,
): TimeRange | null {
  const end = new Date(now.getTime() + 1);
  if (choice === "this_week") return { start: startOfThisWeek(now), end };
  if (choice === "this_month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
  }
  if (choice === "this_year") {
    return { start: new Date(now.getFullYear(), 0, 1), end };
  }
  if (choice === "custom") {
    const start = parseLocalDay(customStart);
    const customRangeEnd = parseLocalDay(customEnd, true);
    return start && customRangeEnd && start < customRangeEnd
      ? { start, end: customRangeEnd }
      : null;
  }
  return { start: new Date(0), end };
}

function spotifyUrl(item: ListeningEvidence): string {
  return (
    item.track.externalUrl ??
    `https://open.spotify.com/search/${encodeURIComponent(
      `${item.track.title} ${item.track.artist}`,
    )}`
  );
}

export function ImportHistoryClient() {
  const today = localDateValue(new Date());
  const [evidence, setEvidence] = useState<readonly ListeningEvidence[]>([]);
  const [phase, setPhase] = useState<ImportPhase>("loading");
  const [rangeChoice, setRangeChoice] = useState<RangeChoice>("all_time");
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);
  const [excludeShort, setExcludeShort] = useState(true);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [status, setStatus] = useState("Loading history saved in this browser…");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void loadImportedHistory()
      .then((stored) => {
        if (!active) return;
        setEvidence(stored);
        setStatus(
          stored.length
            ? `Loaded ${number.format(stored.length)} saved track starts.`
            : "No saved history yet. Choose your Spotify JSON files to begin.",
        );
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Saved history could not be loaded.",
        );
        setStatus("Local history storage is unavailable.");
      })
      .finally(() => {
        if (active) setPhase("ready");
      });
    return () => {
      active = false;
    };
  }, []);

  const range = useMemo(
    () => chosenRange(rangeChoice, customStart, customEnd, new Date()),
    [customEnd, customStart, rangeChoice],
  );
  const view = useMemo(
    () =>
      range
        ? analyzeImportedHistory(evidence, range, {
            recentLimit: 20,
            minimumDurationMs: excludeShort ? THIRTY_SECONDS_MS : 0,
          })
        : null,
    [evidence, excludeShort, range],
  );
  const busy = phase !== "ready";

  async function processHistory(inputs: readonly HistoryInput[]) {
    setPhase("importing");
    setError(null);
    const chunks: Array<readonly ListeningEvidence[]> = [];
    let accepted = 0;
    let ignored = 0;
    let rejected = 0;

    try {
      for (let index = 0; index < inputs.length; index += 1) {
        const input = inputs[index];
        setStatus(`Reading ${input.name} (${index + 1} of ${inputs.length})…`);
        const parsed = parseSpotifyHistoryJson(await input.text(), input.name);
        chunks.push(parsed.evidence);
        accepted += parsed.acceptedCount;
        ignored += parsed.ignoredCount;
        rejected += parsed.rejectedCount;
      }

      setStatus("Deduplicating and saving normalized history locally…");
      const merged = await mergeImportedHistoryIntoStore(chunks);
      setEvidence(merged.evidence);
      setReport({
        accepted,
        ignored,
        rejected,
        duplicates: merged.duplicateCount,
        files: inputs.length,
      });
      setStatus(
        `Import complete. ${number.format(merged.evidence.length)} unique track starts are saved in this browser.`,
      );
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "The history import failed.",
      );
      setStatus("Import stopped. Your previously saved history was not changed.");
    } finally {
      setPhase("ready");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    const totalBytes = selected.reduce((total, file) => total + file.size, 0);
    if (totalBytes > MAX_IMPORT_BYTES) {
      setError(
        "Select no more than 25 MB of JSON files per batch. Import larger exports in multiple batches.",
      );
      setStatus("Import was not started because this batch exceeded 25 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    await processHistory(selected);
  }

  async function importSample() {
    setPhase("importing");
    setError(null);
    setStatus("Loading the synthetic sample…");
    try {
      const response = await fetch("/samples/spotify-history-sample.json");
      if (!response.ok) throw new Error("The sample file is not available yet.");
      const text = await response.text();
      await processHistory([
        { name: "spotify-history-sample.json", text: async () => text },
      ]);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The sample could not be loaded.");
      setStatus("Sample import failed.");
      setPhase("ready");
    }
  }

  async function clearHistory() {
    if (
      !window.confirm(
        "Delete all normalized Spotify history saved by Music with Friends in this browser?",
      )
    ) {
      setStatus("Saved history was kept.");
      return;
    }
    setPhase("clearing");
    setError(null);
    setStatus("Clearing saved history…");
    try {
      await clearImportedHistory();
      setEvidence([]);
      setReport(null);
      setRangeChoice("all_time");
      setStatus("Saved history was cleared from this browser.");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Saved history could not be cleared.");
      setStatus("Clear failed.");
    } finally {
      setPhase("ready");
    }
  }

  return (
    <div className="import-workspace" aria-busy={busy}>
      <section className="import-card import-picker" aria-labelledby="import-picker-title">
        <div>
          <span className="eyebrow">01 · Select history</span>
          <h2 id="import-picker-title">Choose Spotify JSON parts.</h2>
          <p>
            Spotify may split a lifetime export across several files. Select one
            or more at a time; larger exports can be imported in multiple batches.
            Each batch is deduplicated and reduced to timestamp, track, artist,
            and milliseconds played.
          </p>
        </div>
        <div className="import-actions">
          <label className={`button button-primary import-file-button ${busy ? "is-disabled" : ""}`}>
            <span>{phase === "importing" ? "Importing…" : "Choose JSON files"}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              multiple
              disabled={busy}
              onChange={(event) => void importFiles(event.currentTarget.files)}
            />
          </label>
          <button className="button button-ghost" type="button" disabled={busy} onClick={() => void importSample()}>
            Try synthetic sample
          </button>
          {evidence.length > 0 && (
            <button className="import-clear" type="button" disabled={busy} onClick={() => void clearHistory()}>
              Clear saved data
            </button>
          )}
        </div>
        <p className="import-local-note">
          <span aria-hidden="true">●</span> Files stay on this device · 25 MB per batch
        </p>
      </section>

      <div className="import-feedback" aria-live="polite" aria-atomic="true">
        <p className="import-status" role="status">{status}</p>
        {error && <p className="import-error" role="alert">{error}</p>}
      </div>

      {report && (
        <section className="import-report" aria-label="Most recent import report">
          <span><strong>{number.format(report.accepted)}</strong> accepted</span>
          <span><strong>{number.format(report.ignored)}</strong> ignored</span>
          <span><strong>{number.format(report.rejected)}</strong> rejected</span>
          <span><strong>{number.format(report.duplicates)}</strong> duplicates</span>
          <span><strong>{number.format(report.files)}</strong> files</span>
        </section>
      )}

      <section className="import-controls" aria-labelledby="import-range-title">
        <div>
          <span className="eyebrow">02 · Ask a range</span>
          <h2 id="import-range-title">What did you listen to?</h2>
        </div>
        <div className="range-tabs" role="group" aria-label="History range">
          {rangeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={rangeChoice === option.id ? "active" : ""}
              aria-pressed={rangeChoice === option.id}
              onClick={() => setRangeChoice(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="import-toggle">
          <input
            type="checkbox"
            checked={excludeShort}
            onChange={(event) => setExcludeShort(event.currentTarget.checked)}
          />
          <span>Exclude starts under 30 seconds</span>
        </label>
      </section>

      {rangeChoice === "custom" && (
        <div className="import-custom-range">
          <label>
            <span>Start date</span>
            <input type="date" value={customStart} max={customEnd} onChange={(event) => setCustomStart(event.currentTarget.value)} />
          </label>
          <label>
            <span>End date</span>
            <input type="date" value={customEnd} min={customStart} max={today} onChange={(event) => setCustomEnd(event.currentTarget.value)} />
          </label>
          {!range && <p role="alert">Choose an end date on or after the start date.</p>}
        </div>
      )}

      <aside className="import-truth-note" aria-label="Playlist data limitation">
        <span className="eyebrow">Evidence boundary</span>
        <p>
          <strong>Top playlist is unavailable.</strong> Spotify&apos;s export does
          not include playlist context, so this app will not guess which
          playlist caused a historical play.
        </p>
      </aside>

      {phase === "loading" ? (
        <section className="import-empty" aria-label="Loading saved history">
          <span className="import-spinner" aria-hidden="true" />
          <h2>Opening your local history…</h2>
        </section>
      ) : evidence.length === 0 ? (
        <section className="import-empty">
          <span className="import-empty-mark" aria-hidden="true">↳</span>
          <h2>Your real stats will land here.</h2>
          <p>Import your export or use the synthetic sample to exercise the full loop.</p>
        </section>
      ) : view ? (
        <>
          <section className="stats-grid import-stats" aria-label="Imported history summary">
            <article className="stat stat-featured">
              <span>Time listened</span>
              <strong>{formatListeningTime(view.stats.listenedMinutes.value)}</strong>
              <small>Spotify-reported total · shown to the nearest 6 seconds</small>
            </article>
            <article className="stat">
              <span>Track starts</span>
              <strong>{number.format(view.stats.playCount)}</strong>
              <small>{number.format(view.stats.uniqueTrackCount)} unique tracks</small>
            </article>
            <article className="stat">
              <span>Top artist</span>
              <strong className="stat-name">{view.stats.topArtist?.name ?? "—"}</strong>
              <small>{number.format(view.stats.topArtist?.playCount ?? 0)} starts</small>
            </article>
            <article className="stat import-unavailable">
              <span>Top playlist</span>
              <strong className="stat-name">Unavailable</strong>
              <small>Spotify&apos;s export does not include playlist context</small>
            </article>
          </section>

          <section className="import-recent" aria-labelledby="import-recent-title">
            <div className="section-heading">
              <div><span className="eyebrow">Latest in range</span><h2 id="import-recent-title">Recent 20</h2></div>
              <span>{number.format(evidence.length)} saved locally</span>
            </div>
            {view.recent.length ? (
              <ol className="track-list">
                {view.recent.map((item) => (
                  <li key={item.id}>
                    <span className="track-cover cover-lime" aria-hidden="true"><span>{item.track.title.slice(0, 1)}</span></span>
                    <span className="track-copy"><strong>{item.track.title}</strong><small>{item.track.artist}</small></span>
                    <span className="track-who"><strong>{item.actualDurationMs === null ? "Unknown" : `${Math.round(item.actualDurationMs / 1_000)}s`}</strong><small>{item.playedAt ? dateTime.format(new Date(item.playedAt)) : "Unknown time"}</small></span>
                    <a className="spotify-link" href={spotifyUrl(item)} target="_blank" rel="noreferrer" aria-label={`Open ${item.track.title} by ${item.track.artist} in Spotify`}>
                      Open in Spotify <span aria-hidden="true">↗</span>
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="import-no-results">No qualifying track starts fall inside this range.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

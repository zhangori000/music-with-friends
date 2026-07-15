# ADR 004: Analyze user-provided Spotify history locally

- Status: **Accepted for web beta**
- Date: **2026-07-15**

## Context

Spotify's Web API does not provide complete history, actual listened duration,
or arbitrary historical ranges, and its current Developer Policy blocks the
planned derived listener analytics. Spotify separately lets a person request a
copy of their account data, including Extended Streaming History. Uploading that
raw archive to our server would create an unnecessary privacy and breach surface.

## Decision

The web beta accepts one or more user-selected Spotify history JSON files and
processes them inside the browser. It recognizes the current Extended Streaming
History shape and the legacy one-year streaming-history shape. The raw `File`
contents are parsed in memory and are neither uploaded nor stored.

The importer discards podcast rows and rows marked `incognito_mode: true`. It
validates each music row independently, deduplicates overlapping files, and
stores only normalized evidence in IndexedDB:

- event end timestamp;
- Spotify-reported listened milliseconds;
- track title and artist;
- Spotify track ID/link when present; and
- a deterministic local evidence ID.

It does not retain username, IP address, country, device/platform, playback
reason, shuffle/offline flags, album fields, or the original payload. Calculated
views support half-open arbitrary ranges, exact sums of the imported
provider-reported milliseconds, row counts, unique tracks, top artist by
accepted-row count, and the latest 20 accepted rows. “Exact” describes the sum
of imported `ms_played` values; it does not certify that Spotify's archive is
complete or that every row is a full-track play.

This source is `manual-import`, not the Spotify Web API adapter. The import is
private to one browser profile. It does not sync to the API, friends, groups,
public profiles, or the iPhone client. Social redistribution requires a new
decision after provider-policy/legal review, explicit consent, authorization,
retention, export, and deletion controls exist.

## Playlist boundary

The export has no historical playlist context, so it cannot answer “most played
playlist.” Safe, differently named substitutes are:

- **Most launched via this app:** rank explicit playlist-open actions recorded
  by this product; it measures app navigation, not listening.
- **Playlist affinity (approximate):** compare imported track identities with a
  user-supplied playlist inventory, only after policy review; it measures
  similarity and cannot attribute a play to that playlist.
- **User-attested source:** let the user annotate a play or period with a
  playlist; display it as their statement, never provider-verified history.

A continuous observer that polls Spotify Recently Played remains disabled until
Spotify gives written permission for the intended collection, retention,
calculations, and social display. Even with permission, a 50-item rolling window
has gaps and no actual listened duration, so it cannot reconstruct authoritative
history by “just looping.”

## Consequences

The beta immediately answers the useful private-history questions without raw
archive custody or a paid backend. Data is device-local: browser-data clearing,
a different device, or a different browser profile will not preserve it. Mobile
import and social sync are separate features, not implied by this decision.

Primary references: [Spotify: Understanding your data](https://support.spotify.com/us/article/understanding-your-data/),
[Spotify Developer Policy](https://developer.spotify.com/policy), and
[Spotify Recently Played](https://developer.spotify.com/documentation/web-api/reference/get-recently-played).

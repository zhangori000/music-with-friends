# Provider feasibility

Status: **Accepted for the local web beta and private-beta design**

Last reviewed: **2026-07-15**

This is a policy and API capability decision, not legal advice. Re-check the
linked provider terms before enabling live data, changing scopes, monetizing,
or launching outside the private beta.

## Product answer

Use three deliberately separate paths:

1. **Local Spotify export analysis:** the user selects Spotify Extended
   Streaming History JSON; the web browser computes private statistics and
   stores minimal normalized evidence in IndexedDB without uploading the files.
2. **Future consented social analytics:** use ListenBrainz or another approved
   source behind the app API after authentication, sharing, and deletion exist.
3. **Spotify Web API:** direct provider views, metadata, playlist writes, and
   link-out only; it does not feed calculated listener metrics.

The app owns accounts, friendships, groups, visibility, and computed views.
Web and iPhone clients call the same versioned app API for shared product data,
but the current Spotify export beta is intentionally browser-local and does not
use that API.

The current repository has a synthetic social demonstration plus the local web
import beta. The capability boundary is executable in the
[provider capability map](../../src/domain/providers/capabilities.ts), the
[aggregation guard](../../src/domain/listening/aggregate.ts), and provider
contract tests. Live provider connections, server persistence, social history
sync, and iPhone import are not implemented.

## Requested capability matrix

| Product capability | Spotify Web API | User-provided Spotify export | ListenBrainz | Decision |
| --- | --- | --- | --- | --- |
| Recent 20 music plays | Rolling recent snapshot, up to 50; not complete history or proof of completion. | Yes: latest 20 accepted imported rows for the selected range. | Yes: timestamped history supports up to 1,000 per request. | Local beta uses the export. Future social history uses an approved sync source. |
| Top artist or track | Spotify-ranked affinity for approximately 4 weeks, 6 months, and 1 year; no play counts. | Yes: count accepted imported rows in any range. | Top artists, recordings, releases, and release groups include listen counts. | Label export results as imported-history counts, not Spotify's official ranking. |
| Week, month, year, all-time, or custom range | No arbitrary historical range. | Yes: filter imported timestamps locally with half-open ranges. | Raw timestamped history supports arbitrary-range computation; hosted statistics expose fixed ranges. | Local beta answers arbitrary ranges without a server. |
| Actual minutes listened | No. Catalog `duration_ms` is track length, not time actually heard. | Yes: sum Spotify-reported `ms_played` for accepted rows. | `duration_played` is optional and many ingestion paths omit it. | “Exact” means an exact sum of provider-reported values, not a completeness guarantee. |
| Most-played playlist | No supported derived metric. Recent context is not sufficient authority. | No: the export has no historical playlist context. | No documented source-playlist field or top-source-playlist statistic. | Do not claim it; use one of the explicitly labeled substitutes below. |
| Open a song or add it to a playlist | Track URLs and authorized playlist writes are available. | Spotify track URI may provide a safe link-out. | Origin URLs may exist, but ListenBrainz is not the Spotify write authority. | Beta opens Spotify; scoped writes remain separate. |
| Friends, groups, and public profiles | Redistribution and derived analytics require policy review. | Not implemented; local possession is not social-sharing permission. | Listen history is public upstream and CC0. | Keep export analysis private until consent, authorization, policy, and deletion gates pass. |

## Implemented local import boundary

The user requests their history through Spotify's
[account-data process](https://support.spotify.com/us/article/understanding-your-data/)
and selects one or more JSON files in the web app. Parsing, validation,
deduplication, range filtering, and aggregation run in the browser. The current
and legacy export shapes are accepted.

For each accepted music row, IndexedDB receives only the end timestamp,
provider-reported listened milliseconds, title, artist, optional Spotify track
ID/link, and deterministic local evidence ID. The importer does not retain the
raw JSON, username, IP address, country, platform/device, playback reasons,
shuffle/offline flags, or album metadata. Raw files are never uploaded.

Podcast rows and private/incognito rows marked by `incognito_mode: true` are
ignored. Malformed rows are rejected individually so one bad row does not lose
valid history. Overlapping files are deduplicated. The optional short-play
threshold changes the calculated view without rewriting the imported evidence.

The resulting values have precise meanings:

- **Minutes:** exact sum of imported Spotify-reported `ms_played`, rounded for
  display. This is not a claim that the archive is complete.
- **Play count:** number of accepted rows in the range after the chosen
  short-play threshold; it does not assert full-track completion.
- **Top artist:** artist with the most accepted rows in the range.
- **Recent 20:** newest 20 accepted rows in the range.
- **Range:** `[start, end)` over imported event timestamps.

The data remains in one browser profile. It is not synchronized to our server,
friends, groups, public profiles, or the iPhone client. Clearing the import (or
clearing the site's browser data) removes the local app copy.

## Spotify boundary

Spotify can support a direct recently-played screen, Spotify-provided top-item
affinity, track metadata, authorized playlist writes, and link-out. **Spotify
Web API evidence** must not feed the app's play counts, minutes, top artists,
top playlists, comparisons, leaderboards, or cross-source profiles.

The decisive constraint is the [Spotify Developer Policy](https://developer.spotify.com/policy),
which prohibits deriving listenership metrics, usage statistics, user profiles,
or similar analytics from Spotify content. Relevant API facts are documented by
Spotify's [Recently Played endpoint](https://developer.spotify.com/documentation/web-api/reference/get-recently-played),
[Top Items endpoint](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks),
and [Add Items to Playlist endpoint](https://developer.spotify.com/documentation/web-api/reference/add-tracks-to-playlist).

Development mode is also unsuitable as a general launch channel: current
[quota-mode documentation](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
must be reviewed before every rollout. Treat a larger quota as capacity, not as
permission to create analytics.

Do not build a polling loophole. A continuous observer around Recently Played
remains disabled pending written Spotify permission for the exact collection,
storage, calculation, and social-display use. Even with permission, repeatedly
fetching a rolling 50-item snapshot can miss events and does not provide actual
listened duration, so it cannot become authoritative history merely by looping.

## Playlist substitutes

No current source proves which playlist caused historical plays. These may be
useful, but their names and claims must stay distinct:

- **Most launched via our app:** count explicit playlist-open actions in this
  product. This is exact app interaction data, not listening history.
- **Playlist affinity (approximate):** compare imported track identities with a
  user-supplied playlist inventory after policy review. It indicates similarity,
  not playback attribution.
- **User-attested source:** let the user annotate a play or period with a
  playlist. It is the user's statement, not provider-verified context.

None may be displayed as “most played playlist.”

## ListenBrainz boundary

ListenBrainz is the recommended analytics adapter because it supplies
timestamped listens and explicitly publishes user listen data and text under
CC0. Its limitations remain product-visible:

- the [Core API](https://listenbrainz.readthedocs.io/en/latest/users/api/core.html)
  returns timestamped history, accepts at most one of `min_ts` and `max_ts` per
  request, and permits up to 1,000 listens per request;
- the [Statistics API](https://listenbrainz.readthedocs.io/en/latest/users/api/statistics.html)
  supplies listen counts and fixed ranges such as `this_week`, `this_month`,
  `this_year`, and `all_time`;
- the [listen JSON schema](https://listenbrainz.readthedocs.io/en/latest/users/json.html)
  distinguishes optional `duration_played` from catalog duration;
- the [API guide](https://listenbrainz.readthedocs.io/en/latest/users/api/index.html)
  documents manually copied user tokens and dynamic response-header rate
  limits rather than third-party OAuth;
- [data update intervals](https://listenbrainz.readthedocs.io/en/latest/general/data-update-intervals.html)
  are eventually consistent: new listens are fast, statistics are generally
  daily, and backfilled history can take up to two weeks to reach hosted stats;
- [adding data](https://listenbrainz.org/add-data/) supports hosted Spotify and
  Last.fm connections, while many Apple Music and YouTube Music paths are
  community clients, extensions, or scripts.

For a read-only connection, validate the pasted token with `/1/validate-token`
to prove ownership, store the returned ListenBrainz username plus explicit
consent, then discard the user token. A server token or unauthenticated request
can read public history. Retain a user's token only if a later feature genuinely
needs to write on the user's behalf, and then encrypt it server-side.

## Privacy and deletion

Public availability is not consent. Require a user to connect and explicitly
choose who may see imported evidence or aggregates.

ListenBrainz's [terms](https://listenbrainz.org/terms-of-service/) state that
user listen data and text are public under CC0. App visibility therefore hides
data only in this product; it cannot make the upstream ListenBrainz profile
private. The [MetaBrainz GDPR statement](https://metabrainz.org/gdpr) describes
account/listen deletion, but previously downloaded public dumps cannot be
recalled from third parties.

On disconnect, revoke or delete credentials immediately, cancel pending jobs,
and let the user choose whether to delete imported evidence and derived views.
Deleting the app copy does not delete the upstream ListenBrainz account; link
to the provider's deletion controls separately.

## Alternatives considered

**Last.fm** is functionally capable but not the default. Its
[recent-tracks API](https://www.last.fm/api/show/user.getRecentTracks) and top
item APIs expose play counts, but the standard [API terms](https://www.last.fm/api/tos)
limit use to non-commercial purposes, cap retained API data at 100 MB, exclude
artwork, require attribution, use discretionary rate limits, and require
written approval for public pages using the service. Ads or other monetization
would require a commercial agreement.

**Direct Apple Music and YouTube Music analytics** remain `policy-review` or
blocked in the current capability map. Do not implement from remembered API
behavior. Perform a fresh official-docs and terms review, add contract tests,
and then change the capability map.

## Revalidation triggers

Re-open this decision when a provider changes terms or scopes, we add a new
provider, we retain new classes of provider data, the app becomes commercial,
or the UI makes a new claim such as exact minutes or playlist attribution.

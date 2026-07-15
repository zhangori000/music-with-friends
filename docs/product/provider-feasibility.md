# Provider feasibility

Status: **Accepted for the private-beta design**

Last reviewed: **2026-07-14**

This is a policy and API capability decision, not legal advice. Re-check the
linked provider terms before enabling live data, changing scopes, monetizing,
or launching outside the private beta.

## Product answer

Use **ListenBrainz for consented listening analytics** and keep **Spotify as a
direct display and link-out integration**. The app owns accounts, friendships,
groups, visibility, and computed views. Web and iPhone clients call the same
versioned app API.

The current repository is a synthetic demonstration. The capability boundary
is executable in the [provider capability map](../../src/domain/providers/capabilities.ts),
the [aggregation guard](../../src/domain/listening/aggregate.ts), and provider
contract tests. Live provider connections and persistence are not implemented.

## Requested capability matrix

| Product capability | Spotify Web API | ListenBrainz | MVP decision |
| --- | --- | --- | --- |
| Last 20 completed tracks | Yes. Recently Played supports up to 50 per request. | Yes. Timestamped history supports up to 1,000 per request. | Use ListenBrainz for the social history; Spotify may show a direct private snapshot only. |
| Top artist or track | Spotify supplies ranked affinity for approximately 4 weeks, 6 months, and 1 year; it does not supply play counts. | Top artists, recordings, releases, and release groups include listen counts. | Compute and share only from consented ListenBrainz evidence. |
| Week, month, year, all-time, or custom range | No arbitrary historical range. | Raw timestamped history supports local arbitrary-range computation; hosted statistics also expose fixed ranges. | Import raw evidence and aggregate locally. |
| Actual minutes listened | No. Catalog `duration_ms` is track length, not time actually heard. | `duration_played` is optional. Many ingestion paths omit it. | Sum only non-null actual duration and report exact, partial, or unavailable coverage. |
| Most-played playlist | No supported derived metric. Recent context is not sufficient authority to create the statistic. | No documented source-playlist field or top-source-playlist statistic. | Return `null` unless an allowed source provides verified playlist context. |
| Open a song or add it to a playlist | A Spotify URL can open the track. Playlist writes are possible with user authorization and playlist-modify scopes. | ListenBrainz may carry origin URLs, but it is not the Spotify write authority. | MVP opens Spotify. Revisit programmatic playlist writes as a separate scoped feature. |
| Friends, groups, and public profiles | Spotify data redistribution requires policy review and consent; derived analytics remain blocked. | Listen history is already public upstream and CC0. | App authorization controls our copy and UI, but onboarding must disclose upstream publicity. |

## Spotify boundary

Spotify can support a direct recently-played screen, Spotify-provided top-item
affinity, track metadata, and link-out. It must not feed the app's play counts,
minutes, top artists, top playlists, comparisons, leaderboards, or cross-source
profiles.

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

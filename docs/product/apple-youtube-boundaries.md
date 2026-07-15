# Apple Music and YouTube Music boundaries

Decision snapshot: 2026-07-14. Reverify the APIs, policies, and regional rules
before enabling a production integration.

## Capability matrix

| Product need | Apple Music | YouTube Music / Google |
| --- | --- | --- |
| Recent listening | The Apple Music API exposes up to 30 recently played resources. It is a snapshot, not a timestamped play-event feed. | The YouTube Data API does not expose watch history. Google Data Portability can export timestamped YouTube My Activity in supported regions, but it is an asynchronous import rather than a live API. |
| Top artist / playlist | Heavy Rotation is Apple-ranked content without play counts or arbitrary date windows. Display it as provider affinity; do not relabel it as app-computed listening statistics. | YouTube Music Recap exists in the product UI, but no corresponding documented Data API endpoint exists. Computing ranks from Data Portability exports requires separate approval, consent, and policy review. |
| Minutes listened | Unsupported. Recent and Heavy Rotation responses do not provide actual listening duration. | Unsupported. YouTube activity records do not provide actual listened duration. |
| Playlist action | Supported: create a library playlist and add tracks after user authorization. | Supported through `playlistItems.insert`; an inserted video appears in YouTube Music only when YouTube classifies it as music content. |
| Background access | Music User Tokens have device/app authorization semantics; do not model them as a portable cross-device refresh token. Web and iPhone clients should authorize independently. | Server-side OAuth can issue refresh tokens for the YouTube Data API, but that still does not unlock history. Data Portability is a separate grant and export lifecycle. |
| Social/public statistics | Treat as policy/legal review. Apple restricts use of Apple Music user data, metadata, and artwork, including advertising-related uses. | Do not build social derived metrics from YouTube Data API data: the Developer Policies restrict derived metrics and disclosure of authorized data to other users. Data Portability has a different transfer-purpose policy and still needs explicit consent and review. |

## Product decision

- Apple Music: ship account connection, direct Recent/Heavy Rotation surfaces,
  playlist writes, and link-outs. Do not infer plays, time windows, or minutes.
- YouTube Music: ship playlist writes and link-outs through the YouTube Data API.
  Do not claim history or Recap access.
- Keep Google Data Portability as a separate, region-gated batch-import adapter.
  For users outside supported regions, a user-initiated Google Takeout upload is
  the only broad official history fallback.
- Persist `ListeningEvidence`, not a universal `PlayEvent`: `playedAt` and
  `actualDurationMs` stay nullable, and every record retains evidence kind,
  source, consent, and provenance. Catalog track duration never substitutes for
  actual listening duration.

Recommended capability seam:

```ts
type HistoryMode = "none" | "recent-snapshot" | "timestamped-batch";

type ProviderCapabilities = {
  historyMode: HistoryMode;
  exactListenDuration: boolean;
  arbitraryTimeRanges: boolean;
  playlistWrite: boolean;
  backgroundSync: "none" | "device-token" | "refresh-token" | "daily-archive";
  socialRedistribution: "blocked" | "policy-review" | "explicit-consent";
};
```

Keep authorization, listening import, catalog lookup, playlist mutation, and
link-out as separate ports. In particular, YouTube Data API OAuth and Google
Data Portability OAuth are different grants with different policies.

## Official evidence

### Apple

- [Recently played tracks](https://developer.apple.com/documentation/applemusicapi/get-v1-me-recent-played-tracks)
- [Heavy Rotation content](https://developer.apple.com/documentation/applemusicapi/get-heavy-rotation-content)
- [MusicKit authorization and Music User Token behavior (WWDC22)](https://developer.apple.com/videos/play/wwdc2022/10148/)
- [Create a library playlist](https://developer.apple.com/documentation/applemusicapi/create-a-new-library-playlist)
- [Add tracks to a library playlist](https://developer.apple.com/documentation/applemusicapi/add-tracks-to-a-library-playlist)
- [Generate developer tokens and handle HTTP 429](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens)
- [Apple Developer Program membership](https://developer.apple.com/support/compare-memberships/)
- [App Review Guidelines, section 4.5.2](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Developer Program License Agreement](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/)

### YouTube and Google

- [YouTube Data API reference](https://developers.google.com/youtube/v3/docs)
- [Revision history: watch-history playlists are inaccessible](https://developers.google.com/youtube/v3/revision_history)
- [YouTube Music Recap product behavior](https://support.google.com/youtubemusic/answer/13407991)
- [Server-side OAuth](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps)
- [iOS/installed-app OAuth](https://developers.google.com/youtube/v3/guides/auth/installed-apps)
- [`playlistItems.insert` and quota cost](https://developers.google.com/youtube/v3/docs/playlistItems/insert)
- [How YouTube playlists appear in YouTube Music](https://support.google.com/youtubemusic/answer/7205933)
- [Quota and compliance audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- [Data Portability scopes](https://developers.google.com/data-portability/user-guide/scopes)
- [My Activity export schema](https://developers.google.com/data-portability/schema-reference/my_activity)
- [YouTube Music export schema](https://developers.google.com/data-portability/schema-reference/youtube)
- [Time-based Data Portability access](https://developers.google.com/data-portability/user-guide/time-based)
- [Data Portability regional availability](https://support.google.com/accounts/answer/14452558)
- [Data Portability policy](https://developers.google.com/data-portability/policy)
- [Restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [Google Takeout](https://support.google.com/accounts/answer/3024190)

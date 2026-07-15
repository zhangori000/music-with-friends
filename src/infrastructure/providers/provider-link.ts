type ProviderLinkPolicy = "spotify-external" | "listenbrainz-origin";

const allowedHostsByPolicy: Readonly<
  Record<ProviderLinkPolicy, ReadonlySet<string>>
> = {
  "spotify-external": new Set(["open.spotify.com"]),
  // ListenBrainz origin_url is user-submitted metadata. Expose only link
  // destinations this product currently understands and can label correctly.
  "listenbrainz-origin": new Set([
    "musicbrainz.org",
    "open.spotify.com",
  ]),
};

export function parseTrustedProviderLink(
  policy: ProviderLinkPolicy,
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const hasCredentials = url.username !== "" || url.password !== "";
    const hasNonStandardPort = url.port !== "";
    const hasAllowedHost = allowedHostsByPolicy[policy].has(url.hostname);

    if (
      url.protocol !== "https:" ||
      hasCredentials ||
      hasNonStandardPort ||
      !hasAllowedHost
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

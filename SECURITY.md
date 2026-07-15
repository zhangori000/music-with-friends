# Security policy

## Supported version

This project is pre-1.0. Only the latest commit on the default branch is supported with
security fixes. The current public slice uses synthetic social data and a browser-local
Spotify history importer. Raw history is not uploaded, but the normalized IndexedDB
copy is still sensitive. Future live-data work could expose credentials or establish
unsafe defaults if these boundaries regress.

## Report a vulnerability privately

Do not open a public issue containing an exploit, secret, personal data, or unpatched
vulnerability.

Use GitHub's **Report a vulnerability** flow on the repository's Security tab when it
is available. Otherwise, contact the repository owner privately through their GitHub
profile and request a secure channel before sending sensitive details.

Include:

- affected route, component, and commit;
- impact and realistic attack prerequisites;
- minimal reproduction steps or a proof of concept using synthetic accounts/data;
- suggested mitigation, if known;
- whether any credential or real user data may have been exposed.

Do not test against accounts or data you do not own, degrade the public service, or
retain accessed information. The maintainer will acknowledge, reproduce, prioritize,
and coordinate disclosure on a best-effort basis; no response SLA is currently offered.

## Immediate handling priorities

Reports involving these areas are treated as high risk:

- authentication or authorization bypass, including cross-group/profile access;
- exposed provider refresh tokens, service-role keys, encryption keys, or cron secrets;
- OAuth state/PKCE bypass, callback replay, or account-linking confusion;
- remote code execution, injection, XSS, SSRF, or unsafe external redirects;
- deletion/export failures that retain supposedly erased personal data;
- upload, logging, or unintended social disclosure of imported listening history;
- provider-policy bypass that derives or redistributes prohibited data.

If a secret is exposed, revoke or rotate it before investigating secondary symptoms.
Preserve only redacted audit evidence. See
`docs/security/privacy-and-threat-model.md` for the release controls and trust model.

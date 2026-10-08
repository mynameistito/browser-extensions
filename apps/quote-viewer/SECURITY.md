# Security Policy

## Supported Versions

Security fixes are handled on the latest version of `quote-viewer`. Please update to the latest release before reporting an issue unless the vulnerability only affects an older release artifact.

## Reporting A Vulnerability

Do not open a public issue with exploit details, private account data, cookies, tokens, extension keys, or proof-of-concept code that could put users at risk.

Preferred reporting path:

- Use GitHub private vulnerability reporting for this repository, if available.
- If private vulnerability reporting is not available, open a public issue with only a high-level description and ask the maintainer for a private disclosure channel.

Helpful details to include privately:

- Affected browser and version.
- Affected `quote-viewer` version or commit.
- Clear reproduction steps.
- Expected impact and any known limitations.
- Whether the issue affects Chrome, Firefox, or both.

## Scope

In scope:

- Extension behavior on `twitter.com` or `x.com`.
- Manifest permissions and browser-extension security concerns.
- Build or release process issues that could affect shipped extension artifacts.
- Handling of extension keys or release secrets.

Out of scope:

- Vulnerabilities in Twitter/X itself.
- Social engineering, spam, or denial-of-service attacks.
- Reports that require access to private accounts or data without permission.
- Issues already fixed in the latest release.

## Expectations

The maintainer will review valid reports as time allows, ask for clarification when needed, and coordinate a fix before public disclosure when the issue is confirmed.

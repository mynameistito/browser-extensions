# quote-viewer

`quote-viewer` is a cross-browser Manifest V3 extension that restores the "View quote tweets" button on Twitter/X web. It injects a small quote icon into tweet action bars and navigates directly to the tweet's `/quotes` route when clicked.

The extension is written in TypeScript with [WXT](https://wxt.dev/) and targets both Chromium and Firefox.

Originally forked from [View Quote Tweets on Twitter - QuickQuotes](https://chromewebstore.google.com/detail/view-quote-tweets-on-twit/ebjigpojdkoclfidpgjkcgmdnjlajgej) to reduce reliance on closed-source browser extensions.

## Features

- Adds a native-looking quote button to tweets on `twitter.com` and `x.com`.
- Works on dynamically-loaded timelines, profiles, and tweet pages.
- Uses a content script only; there is no popup or background page.
- Builds release zips for Chrome and Firefox from the same codebase.
- Declares no Firefox data collection permissions.

## Requirements

- [Bun](https://bun.sh/)
- OpenSSL, only if you need to generate a persistent Chromium extension key

## Setup

```bash
bun install
```

## Development

```bash
bun run dev          # launch Chromium with the unpacked extension
bun run dev:firefox  # launch Firefox with the unpacked extension
```

WXT writes development builds to `.output/`. You can also load the generated extension directory manually from your browser's extension developer page if needed.

## Build And Package

```bash
bun run build          # build Chromium output
bun run build:firefox  # build Firefox output
bun run zip:all        # create Chrome and Firefox zip files in .output/
```

Release assets are named like `quote-viewer-<version>-chrome.zip` and `quote-viewer-<version>-firefox.zip`.

## Quality Checks

```bash
bun run typecheck
bun run test
bun run test:coverage
bun run check
bun run knip
```

`bun run check` uses Ultracite on top of `oxlint` and `oxfmt`. Use `bun run fix` to apply automatic lint and formatting fixes.

## Persistent Chromium ID

Chromium derives an unpacked extension ID from the extension key. For local development, `wxt.config.ts` reads a gitignored `key.pem` from the repo root and converts it into `manifest.key`, keeping the same extension ID across rebuilds.

Generate a key with:

```bash
bun run generate-key
```

The script writes `key.pem` and prints the resulting extension ID plus the GitHub CLI command to register the private key as the `WXT_CHROME_KEY` GitHub Actions secret:

```bash
Get-Content key.pem -Raw | gh secret set WXT_CHROME_KEY
```

Firefox uses `browser_specific_settings.gecko.id` from `wxt.config.ts`, so it does not need this key.

## Project Structure

- `src/entrypoints/content/` contains the content script, DOM injection, and styles.
- `src/lib/tweet.ts` extracts tweet details and performs quote-route navigation.
- `__tests__/` contains Bun tests for tweet parsing and content-script behavior.
- `scripts/` contains release, changelog, and extension-key helpers.
- `.github/workflows/` runs CI and release automation.

## Releases

Versioning is managed with [Changesets](https://github.com/changesets/changesets):

```bash
bun run changeset                              # interactive prompt
bun run changeset-add patch "Describe change"  # non-interactive helper
```

Use `patch`, `minor`, or `major` with `changeset-add` depending on the release impact.

On pushes to `main`, the release workflow creates or updates the Changesets version PR. Once versioned changes land, CI runs `bun run ci:release`, builds Chrome and Firefox zips, tags the version, and uploads both assets to a GitHub Release.

`WXT_CHROME_KEY` must be set before publishing so Chromium release builds keep the stable extension ID.

## License

[MIT](LICENSE)

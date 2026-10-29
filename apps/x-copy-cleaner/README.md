# X Copy Cleaner

X Copy Cleaner automatically removes tracking query parameters from X/Twitter status URLs. Use X's normal **Copy link** menu item to copy a clean URL, or open a tracked status URL and the address bar is cleaned without reloading the post.

The extension runs locally in the page's main world because X writes its links through the page Clipboard API. It only changes complete `x.com` or `twitter.com` status URLs, leaves other clipboard text untouched, and makes no network requests.

## Requirements

- [Bun](https://bun.sh/)

## Development

Install workspace dependencies from the repository root with `bun install`, then run these commands from `apps/x-copy-cleaner`:

```bash
bun run dev
bun run dev:firefox
bun run build
bun run zip:all
```

WXT creates Manifest V3 builds for Chrome and Firefox under `.output/`. Load `.output/chrome-mv3` from `chrome://extensions` with Developer mode enabled, or select `.output/firefox-mv3/manifest.json` in `about:debugging#/runtime/this-firefox`.

## Quality checks

```bash
bun run typecheck
bun run test
bun run check
```

## Persistent Chromium extension ID

Generate the persistent Chromium signing key from the repository root:

```bash
bun run generate-keys -- --app x-copy-cleaner
```

The script writes a gitignored `key.pem` and prints the GitHub Actions command for the `X_COPY_CLEANER_WXT_CHROME_KEY` secret. Do not commit or share the key. Use `--force` only when intentionally changing the extension ID. Firefox uses its fixed Gecko ID and does not need this key.

## Releases

Versioning uses Changesets. Create a release note from the repository root with:

```bash
bun run changeset-add x-copy-cleaner patch "Describe the change"
```

The release workflow publishes Chrome and Firefox ZIPs plus a source archive to the GitHub release.

## Privacy

The extension declares no API permissions and does not collect or transmit data. It intercepts Clipboard API text writes and normalizes the address bar on X/Twitter status pages, removing only the query string from status URLs.

# Hide Email

A cross-browser extension that scans every web page for a user-defined list of email addresses and replaces each occurrence with `[Email Redacted]`. Built with [WXT](https://wxt.dev), TypeScript, and Bun.

## Features

- Redact specific email addresses on every web page (`<all_urls>`)
- Popup UI to add and remove emails from the redaction list
- Emails persist across sessions and sync across devices via `browser.storage.sync`
- Handles dynamic content (SPA navigation, infinite scroll) via `MutationObserver`
- Never mutates user-editable fields (inputs, textareas, contenteditable)
- Works on Chromium and Firefox

## Install

```bash
bun install
```

## Development

```bash
bun run dev              # Chrome — opens browser with extension loaded
bun run dev:firefox      # Firefox
```

## Build

```bash
bun run build            # → .output/chrome-mv3
bun run build:firefox    # → .output/firefox-mv2
bun run zip              # zipped artifact for store upload
bun run zip:firefox
```

## Type-check & Lint

```bash
bun run typecheck        # tsc --noEmit
bun run check            # ultracite (oxlint + oxfmt)
bun run fix              # auto-fix lint/format issues
```

## Stable Extension ID

Chrome assigns a random extension ID on each build unless an RSA key is embedded in the manifest. Generate one locally:

```bash
# Run from the workspace root.
bun run generate-keys -- --app hide-email-ext
```

The root-level script creates this app's gitignored `key.pem`, prints the stable Chromium extension ID, and prints the command to configure this app's signing secret in the workspace repository. Do not commit or share `key.pem`; use `--force` only when intentionally changing the extension ID.

Run the printed `gh secret set` command to configure the exact Actions secret declared in this app's package manifest.

## Project Structure

```
├── entrypoints/
│   ├── content.ts              # content script — DOM redaction on all pages
│   ├── background.ts           # service worker (reserved for future use)
│   └── popup/
│       ├── index.html          # popup markup
│       ├── popup.ts            # popup logic (add/remove emails)
│       └── popup.css           # minimal dark styling
├── src/lib/
│   ├── types.ts                # shared types (NormalizedEmail, Message, etc.)
│   ├── email.ts                # email validation & normalization
│   ├── redact.ts               # DOM walker + MutationObserver redaction engine
│   ├── storage.ts              # typed wrapper around WXT storage
│   └── messaging.ts            # typed runtime messages (popup ↔ content)
├── public/                     # static icons (16/32/48/96/128 PNG)
├── wxt.config.ts               # WXT config (manifest, permissions)
└── package.json
```

## Permissions

| Permission   | Why                                                       |
| ------------ | --------------------------------------------------------- |
| `storage`    | Persist the email list in `browser.storage.sync`          |
| `<all_urls>` | Run the content script on every page to perform redaction |

No `tabs`, `scripting`, or `activeTab` — minimal permission surface.

## Versioning

Managed with [Changesets](https://github.com/changesets/changesets):

```bash
bunx changeset             # describe the change
bun run version            # bumps package.json + changelog
```

CI automates the version PR and publishes GitHub Releases with Chrome + Firefox zips attached on merge to `main`.

## Tech Stack

- [WXT](https://wxt.dev) — cross-browser extension framework
- [Bun](https://bun.sh) — runtime & package manager
- TypeScript (strict) — end-to-end type safety with branded types
- [Ultracite](https://github.com/nicholasgriffintn/ultracite) — linting & formatting (oxlint + oxfmt)
- [Lefthook](https://github.com/evilmartians/lefthook) — Git hooks
- [Changesets](https://github.com/changesets/changesets) — versioning & changelogs

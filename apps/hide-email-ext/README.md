# Hide Email

A cross-browser extension that blurs a user-defined list of email addresses and, when enabled in the popup, IPv4 and IPv6 addresses on web pages. Addresses appear as random, format-matched decoys until clicked to reveal. Built with [WXT](https://wxt.dev), TypeScript, and Bun.

## Features

- Blur specific email addresses on every web page (`<all_urls>`)
- Optionally blur IPv4 and IPv6 addresses on every web page, showing random addresses with the same format
- Click a blurred address to reveal it; click again to hide it
- Popup UI to add and remove emails from the redaction list
- Emails persist across sessions and sync across devices via `browser.storage.sync`
- Handles dynamic content (SPA navigation, infinite scroll) via `MutationObserver`
- Never mutates user-editable fields (inputs, textareas, contenteditable)
- Works on Chromium and Firefox

## Get started

From the repository root, install dependencies:

```bash
bun install
```

## Develop and build

Run these commands from `apps/hide-email-ext`:

Run the development version in Chrome or Firefox:

```bash
bun run dev              # Chrome — opens browser with extension loaded
bun run dev:firefox      # Firefox
```

Build or package the extension for either browser:

```bash
bun run build            # → .output/chrome-mv3
bun run build:firefox    # → .output/firefox-mv2
bun run zip              # zipped artifact for store upload
bun run zip:firefox
```

## Typecheck and lint

```bash
bun run typecheck        # tsc --noEmit
bun run check            # ultracite (oxlint + oxfmt)
bun run fix              # auto-fix lint/format issues
```

## Persistent Chrome extension ID

Chrome assigns a random extension ID on each build unless an RSA key is embedded in the manifest. Generate a persistent key from the workspace root:

```bash
# Run from the workspace root.
bun run generate-keys -- --app hide-email-ext
```

The root-level script creates this app's gitignored `key.pem`, prints the stable Chromium extension ID, and prints the command to configure `HIDE_EMAIL_WXT_CHROME_KEY` in the workspace repository. Do not commit or share `key.pem`. Use `--force` only when intentionally changing the extension ID.

```powershell
Get-Content apps/hide-email-ext/key.pem -Raw | gh secret set HIDE_EMAIL_WXT_CHROME_KEY --repo mynameistito/browser-extensions
```

## Project structure

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

## Tech stack

- [WXT](https://wxt.dev) — cross-browser extension framework
- [Bun](https://bun.sh) — runtime & package manager
- TypeScript (strict) — end-to-end type safety with branded types
- [Ultracite](https://github.com/nicholasgriffintn/ultracite) — linting & formatting (oxlint + oxfmt)
- [Lefthook](https://github.com/evilmartians/lefthook) — Git hooks
- [Changesets](https://github.com/changesets/changesets) — versioning & changelogs

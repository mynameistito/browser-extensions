# Better History

Powerful browser history search, filtering, and cleanup for Chrome and Firefox.

A modern rewrite of the classic Better History extension — local-only, no telemetry, no backend.

## Features

- Fast full-text search over your browser history
- Date range presets + custom ranges, per-domain views
- Bulk delete with multi-select and keyboard shortcuts
- Blacklist (auto-delete) and whitelist (protect) by URL pattern
- Scheduled cleanup (on-close / daily / weekly / monthly) with configurable retention
- Synced device sessions (recent tabs from your other signed-in browsers)
- Optional opt-in on-device time tracking per domain
- Export to CSV / JSON / HTML / TXT / PDF, import settings from JSON
- Light / dark / system theme, RTL, i18n
- Cross-browser (Chrome MV3 + Firefox)

See [`TODO.md`](./TODO.md) for the v8 rewrite roadmap.

## Privacy

Runs entirely in your browser. No analytics, no telemetry, no remote API. See [`PRIVACY.md`](./PRIVACY.md).

## Stack

- [wxt](https://wxt.dev) — extension framework, MV3, cross-browser
- React 19 + [TanStack Router](https://tanstack.com/router) (memory history) + [TanStack Query](https://tanstack.com/query)
- Tailwind v4 + shadcn-style components + lucide-react
- [virtua](https://github.com/inokawa/virtua) for virtualized lists
- [better-result](https://github.com/zatsu/better-result) for typed errors
- [ultracite](https://www.ultracite.ai) + Biome for lint/format
- Bun runtime

## Develop

```bash
bun install
bun run dev            # Chrome
bun run dev:firefox    # Firefox
```

Load the unpacked extension from `.output/chrome-mv3-dev` (Chrome) or via `web-ext`/`about:debugging` (Firefox).

## Build

```bash
bun run build
bun run build:firefox
bun run zip
bun run zip:firefox
```

Zipped artifacts land in `.output/`.

## Lint / typecheck

```bash
bun run check     # ultracite (Biome)
bun run fix       # auto-fix
bun run compile   # tsc --noEmit
```

## Layout

```
src/
  entrypoints/
    background.ts          # service worker / event page
    popup/                 # toolbar popup SPA
    history/               # full-page SPA (Chrome: chrome_url_overrides; Firefox: opened via action)
  routes/                  # TanStack Router file routes
  features/                # history, domains, cleanup, stats, export, sessions, settings
  lib/                     # browser.* wrappers (better-result), storage, i18n
  ui/                      # shared components
  styles/globals.css
```

## License

[MIT](./LICENSE)

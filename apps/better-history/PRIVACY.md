# Privacy Policy — Better History

Last updated: 2026-05-10.

Better History runs entirely in your browser. It does not have a backend server and does not transmit your browsing data anywhere.

## Data the extension reads

- **Browser history** — read via the `history` permission to display, search, filter, and delete entries on your behalf.
- **Open tabs** — read via the `tabs` and `activeTab` permissions to power features like "open all results" and per-domain actions.
- **Synced sessions** — read via the `sessions` permission to show recent tabs from your other signed-in devices.

## Data the extension stores

All settings, blacklists, whitelists, and (if enabled) on-device time-tracking statistics are stored locally via `chrome.storage.local` / `browser.storage.local` and never leave your device. Uninstalling the extension removes this data.

## Data the extension shares

None. There is no analytics, no telemetry, no remote API, no account system.

## Permissions

| Permission | Why |
|---|---|
| `history` | Core feature: read and delete history entries. |
| `sessions` | Show tabs from other signed-in devices. |
| `tabs`, `activeTab` | Open results, act on the current tab from the popup or context menu. |
| `storage`, `unlimitedStorage` | Save settings and (optional) local time-tracking data. |
| `contextMenus` | Right-click "Search in History", blacklist site, etc. |
| `alarms` | Periodic blacklist enforcement and scheduled cleanup. |
| `favicon` (Chrome only) | Render site icons in lists. |

## Contact

Open an issue at https://github.com/mynameistito/better-history.

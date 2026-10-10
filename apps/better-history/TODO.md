# Better History v8 — Remaining Phases

Phases 1–5 done: scaffold, i18n + storage + better-result wrappers + pattern matcher, background core (install/alarm/context menus/enforcement), history page MVP (search + virtua + bulk delete + presets), domain rules UI.

---

## Phase 6 — Smart cleanup

UI for the scheduled cleanup that already runs in `src/background/enforcement.ts`.

- [x] `src/routes/settings.cleanup.tsx` — form bound to `cleanup` storage key
  - Schedule radio: never / on-close / daily / weekly / monthly
  - Retention radio: 1w / 2w / 1m / 3m
  - Whitelist exempt toggle
- [x] Confirmation modal — type "delete" to confirm, mirrors v7 UX
- [x] "Run now" button → call exported `runCleanup` from background via message bus
- [x] Background: handle `on-close` schedule via `runtime.onSuspend` (MV3 best-effort) + `runtime.onStartup` catchup
- [x] Add Cleanup tab to settings layout + sidebar link

**Files:** `src/routes/settings.cleanup.tsx`, `src/features/cleanup/cleanup-form.tsx`, `src/features/cleanup/confirm-delete-modal.tsx`, `src/lib/messages.ts` (typed `defineExtensionMessaging`)

---

## Phase 7 — Popup polish

Currently popup is a single "open full history" button. Bring it closer to v7.

- [ ] Recent visits list (last 50, today only) — reuse `useHistory` with `preset: "today"`
- [ ] Quick search input — submits → opens `/history.html#/?q=…`
- [ ] Compact row component (no checkboxes)
- [ ] Open-in-new-tab on row click
- [ ] Respect `enablePopup` setting — when disabled, popup just bounces to history page

**Files:** `src/entrypoints/popup/main.tsx`, `src/features/history/recent-list.tsx`

---

## Phase 8 — Sessions / Devices

- [ ] `src/routes/sessions.tsx` — list `browser.sessions.getDevices()` results
- [ ] Group by device → list of windows → list of tabs
- [ ] Click tab → `tabs.create({ url })`
- [ ] Empty state: "No active device sessions found"
- [ ] Sidebar link

**Files:** `src/routes/sessions.tsx`, `src/features/sessions/devices-tree.tsx`

---

## Phase 9 — Time tracking (Stats)

Opt-in, gated by `enableStats` setting + `idle` permission.

- [ ] Permission flow: request `idle` via `permissions.request`; show explainer modal
- [ ] Tracker state machine in background: tabs.onActivated/onUpdated/onRemoved + idle.onStateChanged
  - States: active → idle (after `IDLE_THRESHOLD`) → away
  - On exit-active: persist increment to `tracking[domain]`
- [ ] Configurable idle threshold (default 60s)
- [ ] Detect media playback (skip idle while playing) — content script registers via `chrome.scripting` (optional perm)
- [ ] `src/routes/stats.tsx` — overview: total, top domains, most active day, avg/day
- [ ] `src/routes/stats.$host.tsx` — per-domain detail: sessions list, day chart
- [ ] Clear all stats / clear single domain
- [ ] Sidebar link (gated)

**Files:** `src/background/tracker.ts`, `src/features/stats/*`, `src/routes/stats.tsx`, `src/routes/stats.$host.tsx`

**Open question:** chart library — recharts vs hand-rolled SVG. Decide before scaffolding stats.

---

## Phase 10 — Export / Import

- [ ] `src/features/export/exporters.ts` — pure functions: `toCSV`, `toJSON`, `toHTML`, `toTXT` from `HistoryItem[]`
- [ ] `src/features/export/download.ts` — Blob + `URL.createObjectURL` + anchor click
- [ ] `src/routes/export.tsx` — format radio + range selector (preset/custom/selected) + download button
- [ ] PDF export (last) — jsPDF; lazy import to avoid bloating main bundle
- [ ] **Import local data** — JSON file input → zod parse against `StorageSchema` keys → merge or overwrite blacklist/whitelist/settings/cleanup. Strict size cap 5MB.
- [ ] Export time-tracking data (if `enableStats`)

**Files:** `src/features/export/*`, `src/routes/export.tsx`, `src/routes/import.tsx`

---

## Phase 11 — Display settings

- [ ] `src/routes/settings.display.tsx`
  - Theme: system / light / dark — apply via `<html data-theme>` and Tailwind
  - Font size: small / medium / large
  - Direction: ltr / rtl (set on `<html dir>`)
  - Date format: dropdown of common patterns
  - Time format: 12 / 24
  - Toolbar icon: default / light / dark — call `browser.action.setIcon`
  - Infinite scroll toggle
  - Open in new tab toggle
  - Enable popup toggle
  - Enable stats toggle (triggers perm flow)
  - Context menu toggles: searchDomain, searchText
- [ ] Provider in `__root.tsx` reads settings + applies theme/dir/font CSS vars
- [ ] i18n: language picker (browser-managed via `_locales`, but allow override stored in `settings.locale`)

**Files:** `src/routes/settings.display.tsx`, `src/features/settings/theme-provider.tsx`, `src/lib/icon.ts`

---

## Phase 12 — Custom date range + per-domain view

- [ ] `src/routes/custom.tsx` — date range picker (two `<input type="date">` is fine; upgrade later)
- [ ] `src/routes/domain.$host.tsx` — all visits to a domain, reusing `HistoryList`
- [ ] Sidebar: link to "Custom range"

**Files:** `src/routes/custom.tsx`, `src/routes/domain.$host.tsx`, `src/features/history/date-range-picker.tsx`

---

## Phase 13 — Polish + accessibility

- [ ] Keyboard nav: arrow keys in list, `Cmd/Ctrl+A` select all, `Delete` removes selected, `/` focuses search
- [ ] Toasts for actions (delete N items, save settings, etc.) — small zustand-free implementation
- [ ] Empty / error / loading states audited everywhere
- [ ] Focus rings on all interactive elements
- [ ] Aria labels on icon-only buttons
- [ ] Dark mode pass — verify every screen
- [ ] RTL pass — verify layouts mirror
- [ ] Lighthouse / axe audit on history page

**Files:** `src/ui/toast.tsx`, `src/ui/dialog.tsx` (shadcn-style)

---

## Phase 14 — Icons + assets + manifest hardening

- [ ] Real PNG icons in `src/public/icon/` at 16, 32, 48, 128
- [ ] Add to manifest `icons` + `action.default_icon`
- [ ] Toolbar icon themes (default / light / dark) — extra PNG sets
- [ ] Suppress wxt firefox warning: `suppressWarnings.firefoxDataCollection: true` once policy reviewed
- [ ] Set Firefox `data_collection_permissions: { required: ["none"] }` (true: extension collects nothing)
- [ ] Verify `manifest.json` MV3 strictness on both browsers
- [ ] Lock minimum browser versions

**Files:** `wxt.config.ts`, `src/public/icon/*`

---

## Phase 15 — Tests + CI

- [ ] Unit tests: ranges (preset → time window), exporters (CSV/JSON/HTML escaping), tracker state machine
- [ ] Integration tests: storage roundtrip with zod (already partial)
- [ ] E2E smoke with `@wxt-dev/test` or Playwright headless: load extension, open history page, search, delete, verify
- [ ] GitHub Actions: matrix `[chrome, firefox]` → `bun run check && bun test && bun run build && bun run zip`
- [ ] Upload zip artifacts on tag

**Files:** `.github/workflows/ci.yml`, `tests/e2e/*`

---

## Phase 16 — Store submission

- [ ] Chrome Web Store
  - Privacy policy URL → raw GitHub `PRIVACY.md`
  - Single-purpose statement
  - Permissions justification per permission
  - Screenshots (1280×800) — at least 3
  - Demo video (optional)
- [ ] Firefox AMO
  - Source code submission (Mozilla policy for minified bundles)
  - Same screenshots resized to AMO specs
  - Privacy policy URL
  - Add-on signing handled by AMO
- [ ] Tag `v8.0.0` in repo, attach both zips to release

---

## Cross-phase backlog

- [ ] **Replace** `lucide-react@1.14.0` (very old major) — migrate to current `lucide-react` matching React 19 peer
- [ ] **Replace** `console.error` calls with proper toast/error reporting once Phase 13 toast lands
- [ ] **Performance**: investigate splitting heavy date-fns / virtua chunks if bundle exceeds 1MB
- [ ] **Service worker keepalive**: confirm 5-min alarm prevents SW eviction; add fallback ping if needed
- [ ] **Storage quota**: monitor `tracking` blob size; rotate / compact if approaching 5MB local quota even with `unlimitedStorage`
- [ ] **Decide** chart library for stats (Phase 9)

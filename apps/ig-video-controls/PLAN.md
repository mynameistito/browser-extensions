# PLAN — Full rewrite of `Controls for Instagram Videos` as `ig-video-controls`

## 0 — Summary

Rewrite the legacy Chrome MV3 extension in `temp/ext/` as a TypeScript WXT
extension that mirrors the structure of `~/code/mynameistito/quote-viewer`.
The new extension only ships the **core** video-control behaviour (native
HTML5 controls + remember volume / playback rate + mouse-wheel hotkeys) on
both Chrome and Firefox, with persistent extension IDs and the same
Changesets → GitHub Actions release pipeline.

### Decided constraints (confirmed by user)

| #   | Topic               | Decision                                                                                                                                                                                        |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Telemetry           | **Drop** all uninstall-URL / usage-stats code. Credit original author in README only.                                                                                                           |
| 1   | `homepage_url`      | `https://github.com/mynameistito/ig-video-controls`                                                                                                                                             |
| 1   | Identity            | `name = "Instagram Video Controls"`, `short_name = "ig-vid-ctrls"`, `author = "mynameistito"`                                                                                                   |
| 2   | Scope               | **Core feature port** only. Drop the commented-out mute-sync, `ErrorStackParser`, `Stackframe`, `recordEx`, `FloodTracker`, `recordUsageStats`, debug `log()`, `_metadata/`, `update_url`, etc. |
| 3   | Options page        | **Dropped.** Hardcode defaults.                                                                                                                                                                 |
| 4   | Browsers            | Chrome **and** Firefox (mirror quote-viewer).                                                                                                                                                   |
| 5   | Persistent ID       | Fresh `key.pem` produced by `bun run gen-key`. Do **not** reuse the upstream `MIIB…` key.                                                                                                       |
| 6   | Hotkeys             | Full rewrite — no `chrome.commands`, no `Alt+Up/Down`. Mouse-wheel only:                                                                                                                        |
|     |                     | • `Ctrl + wheel` over a video → playback rate ±step                                                                                                                                             |
|     |                     | • `RMB-held + wheel` over a video → volume ±step (suppress contextmenu when wheeled with RMB held)                                                                                              |
| 7   | Matches             | `https://*.instagram.com/*`, `all_frames: true` (keep iframe-embed support).                                                                                                                    |
| 8   | Repo + release zips | `github.com/mynameistito/ig-video-controls`; assets `ig-video-controls-<v>-chrome.zip`, `ig-video-controls-<v>-firefox.zip`.                                                                    |

### Defaults hardcoded (since options page is dropped)

```ts
const DEFAULTS = {
  rememberVolumeLevel: true,
  rememberPlaybackRate: true,
  volumeLevel: 1,
  playbackRate: 1,
  volumeAdjustmentStepSize: 0.1,
  playbackRateAdjustmentStepSize: 0.25,
};
```

Volume/playback are still **persisted** in `browser.storage.local` so that
adjustments stick across page loads and across tabs (this is the genuinely
useful half of the original options).

---

## 1 — Target file tree

```
ig-video-controls/
├─ .changeset/
│  ├─ README.md                  # boilerplate from quote-viewer
│  └─ config.json                # identical to quote-viewer
├─ .github/
│  └─ workflows/
│     └─ release.yml             # identical to quote-viewer
├─ .vscode/
│  └─ settings.json              # (optional — copy if exists in quote-viewer)
├─ public/
│  └─ icon/
│     ├─ 16.png                  # from temp/ext/icons/play-16x16.png
│     ├─ 48.png                  # from temp/ext/icons/play-48x48.png
│     └─ 128.png                 # from temp/ext/icons/play-128x128.png
├─ scripts/
│  ├─ ci-release.ts              # adapted from quote-viewer (rename refs)
│  ├─ gen-key.ts                 # adapted from quote-viewer (rename refs)
│  └─ linkify-changelog.ts       # identical to quote-viewer
├─ src/
│  ├─ entrypoints/
│  │  ├─ background.ts           # storage init + persistence broadcaster
│  │  └─ content/
│  │     ├─ index.ts             # defineContentScript main()
│  │     ├─ style.css            # ported from temp/ext/styles.css (renamed classes)
│  │     ├─ dom.ts               # query helpers, debounce, throttle
│  │     ├─ video-controls.ts    # modifyVideo + native-controls injection + layout fixes
│  │     ├─ button-finder.ts     # findVolumeOrTagsButtons, page-type detectors
│  │     ├─ overlay-fixes.ts     # modifyOverlayWithInstagramPlayControl, story height fixes
│  │     ├─ wheel-hotkeys.ts     # Ctrl+wheel / RMB+wheel handlers (NEW)
│  │     └─ settings.ts          # typed storage.local wrapper (no UI)
│  └─ lib/
│     └─ math.ts                 # clamp, snapToStep, valuesAreDifferentEnough
├─ .gitignore                    # copy quote-viewer's verbatim (already has key.pem, temp/, .output, .wxt)
├─ LICENSE                       # MIT, same boilerplate as quote-viewer
├─ README.md                     # rewrite (sections below)
├─ bun.lock                      # generated by bun install
├─ lefthook.yml                  # identical to quote-viewer
├─ oxfmt.config.ts               # identical
├─ oxlint.config.ts              # identical
├─ package.json                  # see §3
├─ tsconfig.json                 # identical to quote-viewer
├─ wxt.config.ts                 # see §4
└─ PLAN.md                       # this file (delete once executed, or move to docs/)
```

`key.pem` is generated locally by the dev — never committed (already in
`.gitignore`).

---

## 2 — Diagram: how the pieces connect

```diagram
                       ╭──────────────────────────────╮
                       │   browser.storage.local      │
                       │  (volumeLevel, playbackRate, │
                       │   rememberVolumeLevel, etc.) │
                       ╰──────────────┬───────────────╯
                                      │  onChanged
        ╭───────────────╮             ▼             ╭────────────────╮
        │ background.ts │ ───seeds──▶ │ ◀───reads── │  content script│
        │ (onInstalled) │             │             │   index.ts     │
        ╰───────────────╯             ▲             ╰────────┬───────╯
                                      │                      │
                       writes (set/save) ─────────────────── │
                                                             ▼
                            ╭──────────────────────────────────────╮
                            │     IG video DOM mutations           │
                            │  • enable .controls                  │
                            │  • inject -webkit-media-controls CSS │
                            │  • raise overlays / fade ig buttons  │
                            │  • Stories: incapacitate overlays    │
                            │  • Stories: send-message box fixup   │
                            ╰──────────────────────────────────────╯
                                            ▲
                                            │ wheel / contextmenu events
                            ╭──────────────────────────────────────╮
                            │  wheel-hotkeys.ts                    │
                            │  Ctrl+wheel  → speed ± step          │
                            │  RMB+wheel   → volume ± step         │
                            │  (suppress contextmenu while RMB    │
                            │   has been combined w/ a wheel)      │
                            ╰──────────────────────────────────────╯
```

---

## 3 — `package.json`

```json
{
  "name": "ig-video-controls",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "dev:firefox": "wxt -b firefox",
    "build": "wxt build",
    "build:firefox": "wxt build -b firefox",
    "zip": "wxt zip",
    "zip:firefox": "wxt zip -b firefox",
    "zip:all": "bun run zip && bun run zip:firefox",
    "gen-key": "bun scripts/gen-key.ts",
    "postinstall": "wxt prepare",
    "typecheck": "tsgo --noEmit",
    "check": "ultracite check",
    "fix": "ultracite fix",
    "changeset": "changeset",
    "version": "changeset version && bun scripts/linkify-changelog.ts && wxt prepare",
    "release": "bun run zip",
    "ci:release": "bun run scripts/ci-release.ts",
    "prepare": "lefthook install"
  },
  "devDependencies": {
    "@changesets/cli": "^2.31.0",
    "@types/bun": "^1.3.14",
    "@typescript/native-preview": "^7.0.0-dev.20260524.1",
    "lefthook": "^2.1.8",
    "oxfmt": "^0.51.0",
    "oxlint": "^1.66.0",
    "ultracite": "7.7.0",
    "wxt": "^0.20.26"
  }
}
```

(Versions copied 1:1 from quote-viewer to keep the toolchain identical.)

---

## 4 — `wxt.config.ts`

```ts
import { createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig } from "wxt";

const loadPemSource = (): string | undefined => {
  const fromEnv = process.env.WXT_CHROME_KEY;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const keyPath = resolve("key.pem");
  if (existsSync(keyPath)) return readFileSync(keyPath, "utf-8");
};

const loadManifestKey = (): string | undefined => {
  const pem = loadPemSource();
  if (!pem) return;
  const spkiPem = createPublicKey(pem).export({
    format: "pem",
    type: "spki",
  }) as string;
  return spkiPem
    .replaceAll("-----BEGIN PUBLIC KEY-----", "")
    .replaceAll("-----END PUBLIC KEY-----", "")
    .replaceAll(/\s+/gu, "");
};

export default defineConfig({
  manifest: ({ browser }) => {
    const base = {
      name: "Instagram Video Controls",
      short_name: "ig-vid-ctrls",
      description:
        "Adds the native HTML5 player (seek bar, volume, fullscreen, PiP) to Instagram videos, plus Ctrl+wheel speed and RMB+wheel volume hotkeys.",
      homepage_url: "https://github.com/mynameistito/ig-video-controls",
      permissions: ["storage"],
    };

    if (browser === "firefox") {
      return {
        ...base,
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: { required: ["none"] },
            id: "ig-video-controls@mynameistito.com",
            strict_min_version: "140.0",
          },
        },
      };
    }

    const key = loadManifestKey();
    return {
      ...base,
      minimum_chrome_version: "88",
      ...(key ? { key } : {}),
    };
  },
  outDir: ".output",
  srcDir: "src",
});
```

(WXT auto-generates icon entries from `public/icon/{16,48,128}.png`. Content
scripts and background are declared by their `defineContentScript` /
`defineBackground` entrypoints — no manual `content_scripts` block needed.)

---

## 5 — Content-script port (legacy → new)

The legacy code is ~1031 lines split across `InstagramVideoControls.js`,
`ic-util.js`, `ic-content-script-init.js`, `ic-background.js`, plus
`ErrorStackParser.js` / `Stackframe.js`. Map them as follows:

| Legacy file / function                                                                                                                                                                                                                                                                                                                                                                                                                                    | New location                                            | Action                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ic-content-script-init.js` (`main()` bootstrapper)                                                                                                                                                                                                                                                                                                                                                                                                       | `src/entrypoints/content/index.ts`                      | Replace with `defineContentScript({ matches, allFrames: true, runAt: "document_end", cssInjectionMode: "manifest", main() { … } })`.                                                                                              |
| `InstagramVideoControls.init()`, `modifyAllPresentVideos`, `MutationObserver` setup                                                                                                                                                                                                                                                                                                                                                                       | `content/index.ts`                                      | Ported. Initial sweep + a single document-wide `MutationObserver({childList, subtree})` that batches via `requestAnimationFrame` and calls `modifyVideo` for each newly-attached `<video>`.                                       |
| `modifyVideo`, `modifyVideoElement`, `videoControlsAlreadyInitialized`, `redefineWebkitMediaControlHidingCssRule`, `setVolumeIfChanged`, `setPlaybackRateIfChanged`, `setVolumeOfPreviouslySeenVideoElements`, `setPlaybackRateOfPreviouslySeenVideoElements`, `valuesAreDifferentEnough`, `knownVideoElements`                                                                                                                                           | `content/video-controls.ts`                             | Ported 1:1 to TS, `knownVideoElements` becomes a module-level `Set<HTMLVideoElement>`. Drop the `dataset.nativeControlsISetJooFree` joke flag → rename to `dataset.igvcInit = "1"`; CSS selector in `style.css` updated to match. |
| `modifyOverlayWithInstagramPlayControl`, `findPlayButton`, `findControlButton`, `getVideoCoveringButtons`, `looksLikeCoversVideo`, `findVolumeOrTagsButtons`, `isInstagramStoriesPage`, `isInstagramReelsPage`, `isInstagramHomePage`, `getComponentRootForStoryVideo`, `getEstimatedVideoComponentRootElement`, `modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls`, `nthParent`, `nParents`, `incapacitateStoryVideoPausingOverlays` | `content/overlay-fixes.ts` + `content/button-finder.ts` | Ported. Split: page-type detectors + button-finder go to `button-finder.ts`; overlay layout hacks go to `overlay-fixes.ts`. All `aria-label`/SVG-path heuristics and the multi-language fallbacks are preserved.                  |
| `ic-util.js` → `debounce`, `throttle`, `leadingAndTrailingFiringThrottle`, `query`, `queryAll`, `fromHtml`, `cmpToPrecision`, `getAllElementSiblings`                                                                                                                                                                                                                                                                                                     | `content/dom.ts`                                        | Ported. **Drop** `watchEx`, `recordEx`, `recordUsageStats`, `getFunctionName`, `augmentFunctionName`, `FloodTracker`. Drop `byId`.                                                                                                |
| `ic-util.js` → math helpers (`clamp`, `snapToStepSize`) — currently in `ic-background.js`                                                                                                                                                                                                                                                                                                                                                                 | `src/lib/math.ts`                                       | Pure functions, importable by both content + background.                                                                                                                                                                          |
| `ic-background.js` → `chrome.commands.onCommand` listener                                                                                                                                                                                                                                                                                                                                                                                                 | **DELETED.**                                            | Replaced by mouse-wheel hotkeys in content script.                                                                                                                                                                                |
| `ic-background.js` → `recordInstall`, `buildUrlRespectingMaxLength`, `updateUninstallUrl`, `countErrors`, `setUninstallURL`                                                                                                                                                                                                                                                                                                                               | **DELETED.**                                            | All telemetry removed.                                                                                                                                                                                                            |
| `ic-background.js` → `chrome.runtime.onInstalled`                                                                                                                                                                                                                                                                                                                                                                                                         | `src/entrypoints/background.ts`                         | Kept only to seed `DEFAULTS` into `storage.local` on first install.                                                                                                                                                               |
| `ErrorStackParser.js`, `Stackframe.js`                                                                                                                                                                                                                                                                                                                                                                                                                    | **DELETED.**                                            | Only used by `recordEx`.                                                                                                                                                                                                          |
| `_metadata/`, `update_url`, `key` (upstream)                                                                                                                                                                                                                                                                                                                                                                                                              | **DELETED.**                                            | Persistent ID comes from our own `key.pem`.                                                                                                                                                                                       |
| `options.html`, `options.js`                                                                                                                                                                                                                                                                                                                                                                                                                              | **DELETED.**                                            | No options page (per user).                                                                                                                                                                                                       |
| `styles.css`                                                                                                                                                                                                                                                                                                                                                                                                                                              | `src/entrypoints/content/style.css`                     | Rename `ctrls4insta-*` classes → `igvc-*`. Replace `data-native-controls-i-set-joo-free` with `data-igvc-init`. Keep `raise-button`, `fade-button`, `disable-native-play-button` rules.                                           |

### `wheel-hotkeys.ts` — new module (replaces `chrome.commands`)

```ts
// Approx 60-80 lines.
// State (module-level):
//   let rmbHeld = false;
//   let rmbUsedWheel = false;
//
// Attach:
//   document.addEventListener("mousedown",  onMouseDown,  { capture: true });
//   document.addEventListener("mouseup",    onMouseUp,    { capture: true });
//   document.addEventListener("contextmenu", onContextMenu, { capture: true });
//   document.addEventListener("wheel", onWheel, { capture: true, passive: false });
//
// onWheel: if target.closest('video[data-igvc-init]') === null → return.
//   - if (e.ctrlKey)  → bump playbackRate by sign(deltaY) * step;  e.preventDefault();
//   - else if (rmbHeld) → bump volume by sign(deltaY) * step;        e.preventDefault();
//                          rmbUsedWheel = true;
//
// onContextMenu: if rmbUsedWheel → e.preventDefault(); reset flag.
//
// Bumps go through the same saveVolumeLevel / savePlaybackRate path that
// the legacy code uses, so persistence + broadcast-to-other-videos still
// work via storage.onChanged.
```

Edge cases handled:

- Modifier keys: `Ctrl+wheel` wins over `RMB+wheel` if both are held.
- Pinch-zoom prevention (`preventDefault` on `wheel`) only when we actually consume the event.
- Touchpad pinch (`e.ctrlKey === true` but `deltaY` may be fractional) — fine, we still snap.
- Right-click drag selection on the page is unaffected because we only suppress `contextmenu` if the user actually scrolled while holding RMB.

### `settings.ts` — typed storage wrapper

```ts
type Settings = {
  rememberVolumeLevel: boolean;
  rememberPlaybackRate: boolean;
  volumeLevel: number;
  playbackRate: number;
  volumeAdjustmentStepSize: number;
  playbackRateAdjustmentStepSize: number;
};
export const DEFAULTS: Settings = { … };
export async function loadSettings(): Promise<Settings>;
export async function saveSettings(patch: Partial<Settings>): Promise<void>;
export function onSettingsChanged(cb: (s: Settings) => void): () => void;
```

Both the content script and background use this.

### `background.ts`

```ts
import { defineBackground } from "#imports";

import { DEFAULTS } from "../../lib/defaults";

export default defineBackground(async () => {
  const current = await browser.storage.local.get(DEFAULTS);
  await browser.storage.local.set({ ...DEFAULTS, ...current });
});
```

(No telemetry, no uninstall URL, no commands.)

---

## 6 — Scripts

### `scripts/gen-key.ts`

Identical to quote-viewer except the `gh secret set` hint references the
same secret name `WXT_CHROME_KEY`. No other changes (the script is
package-agnostic — output is `key.pem` at repo root).

### `scripts/linkify-changelog.ts`

Identical — uses `git remote get-url origin`, no hardcoded repo.

### `scripts/ci-release.ts`

Adapted: every occurrence of `quote-viewer` → `ig-video-controls`. The
`EXPECTED_ASSETS` function becomes:

```ts
const EXPECTED_ASSETS = (ver: string) => [
  `ig-video-controls-${ver}-chrome.zip`,
  `ig-video-controls-${ver}-firefox.zip`,
];
```

and the zip paths:

```ts
const chromeZip = resolve(
  ROOT,
  `.output/ig-video-controls-${version}-chrome.zip`
);
const firefoxZip = resolve(
  ROOT,
  `.output/ig-video-controls-${version}-firefox.zip`
);
```

(WXT's `wxt zip` derives the zip name from the package `name`, so as long
as `package.json#name === "ig-video-controls"` the filenames line up.)

Everything else (gh-release creation, tag handling, idempotency,
`WXT_CHROME_KEY` injection, changelog extraction) is left alone.

---

## 7 — CI / GitHub Actions

`.github/workflows/release.yml` — **byte-for-byte identical** to
quote-viewer. It already drives:

1. PR-based Changesets versioning (`bun run version` → bumps
   `package.json`, regenerates `CHANGELOG.md`, runs `linkify-changelog.ts`,
   runs `wxt prepare`).
2. When the version PR merges and there are no remaining changesets, runs
   `bun run ci:release` which builds both browsers, tags, and uploads to a
   GitHub Release.

### Repo-side prep the user must do once

1. `bun run gen-key` (generates `key.pem`, prints extension ID).
2. **Windows (PowerShell):**
   `Get-Content key.pem -Raw | gh secret set WXT_CHROME_KEY`
   **macOS / Linux (bash/zsh):**
   `gh secret set WXT_CHROME_KEY < key.pem`
3. Push the repo to `github.com/mynameistito/ig-video-controls`.
4. Ensure GitHub Actions has "Read and write" workflow permission (already
   in repo settings if quote-viewer worked).

---

## 8 — Changesets

`.changeset/config.json` — copy from quote-viewer verbatim:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.4/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "privatePackages": { "version": true, "tag": true }
}
```

`.changeset/README.md` — copy from quote-viewer verbatim.

Seed the first changeset:

`.changeset/initial-rewrite.md`:

```md
---
"ig-video-controls": minor
---

Initial TypeScript / WXT rewrite. Native HTML5 video controls for
Instagram, with persistent volume + playback rate, and new mouse-wheel
hotkeys (Ctrl+wheel = speed, RMB+wheel = volume).
```

---

## 9 — `.gitignore`, `lefthook.yml`, lint configs, `tsconfig.json`, `LICENSE`

All copied **verbatim** from quote-viewer. The existing root `.gitignore`,
`oxfmt.config.ts`, `oxlint.config.ts` in this repo will be **replaced** by
the quote-viewer versions (they're already extremely similar; harmonising
keeps the toolchain identical).

`tsconfig.json` is copied verbatim — extends `./.wxt/tsconfig.json` and
includes `src/**/*`, `wxt.config.ts`, `scripts/**/*`.

---

## 10 — Icons

Copy the three PNGs out of `temp/ext/icons/` into `public/icon/`:

| Source                            | Destination           |
| --------------------------------- | --------------------- |
| `temp/ext/icons/play-16x16.png`   | `public/icon/16.png`  |
| `temp/ext/icons/play-48x48.png`   | `public/icon/48.png`  |
| `temp/ext/icons/play-128x128.png` | `public/icon/128.png` |

(`playback-speed-gui.png` is only used by the deleted options page —
skip it.)

WXT discovers these automatically and produces the right `manifest.icons`
entry per browser.

---

## 11 — README.md outline

Modelled after quote-viewer's README, with these adjustments:

1. **Title / blurb** — what the extension does (native HTML5 player on
   IG videos, mouse-wheel hotkeys, remembered settings).
2. **Credit** — "Originally based on _Controls for Instagram Videos_ by
   Chris Rehfeld (rehfeldchris@gmail.com). This is an independent
   TypeScript rewrite; all telemetry / uninstall analytics removed."
3. **Hotkeys** — table:
   - `Ctrl + Mousewheel ↑/↓` over a video → speed up / down
   - `Hold Right Mouse Button + Mousewheel ↑/↓` over a video → volume up / down
4. **Setup / `key.pem` / `gen-key`** — identical wording to quote-viewer.
5. **Dev / build / zip / release** — identical wording.
6. **License** — MIT.

---

## 12 — Step-by-step execution order (for the implementer agent)

Execute these in order. Each step is independently verifiable.

### Phase A — Scaffold

1. Copy from quote-viewer (verbatim):
   - `.changeset/config.json`, `.changeset/README.md`
   - `.github/workflows/release.yml`
   - `lefthook.yml`, `oxfmt.config.ts`, `oxlint.config.ts`
   - `tsconfig.json`, `LICENSE`, `.gitignore`
2. Adapt and write:
   - `package.json` (§3)
   - `wxt.config.ts` (§4)
   - `scripts/gen-key.ts` (verbatim from quote-viewer)
   - `scripts/linkify-changelog.ts` (verbatim)
   - `scripts/ci-release.ts` (rename `quote-viewer` → `ig-video-controls`)
3. Copy icons into `public/icon/` (§10).
4. `bun install` — should succeed; `postinstall` runs `wxt prepare` and
   generates `.wxt/`.

**Verify A:** `bun run typecheck` passes on the empty `src/`.

### Phase B — Settings + background

5. Create `src/entrypoints/content/settings.ts` with `DEFAULTS`, typed
   getter/setter/listener.
6. Create `src/entrypoints/background.ts` (seeds defaults on install).

**Verify B:** `bun run build` succeeds; load `.output/chrome-mv3/` as an
unpacked extension; confirm `chrome.storage.local` is populated with the
six default keys on first install.

### Phase C — Content script: helpers + core video logic

7. Port `dom.ts` (debounce, throttle, query, queryAll, fromHtml,
   cmpToPrecision, getAllElementSiblings).
8. Port `src/lib/math.ts` (clamp, snapToStep, valuesAreDifferentEnough).
9. Port `button-finder.ts` — page-type detectors, `findVolumeOrTagsButtons`,
   `getVideoCoveringButtons`, `looksLikeCoversVideo`,
   `getEstimatedVideoComponentRootElement`, `nthParent`, `nParents`,
   `getComponentRootForStoryVideo`.
10. Port `overlay-fixes.ts` — `modifyOverlayWithInstagramPlayControl`,
    `incapacitateStoryVideoPausingOverlays`,
    `modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls`,
    reels gradient tweak.
11. Port `video-controls.ts` — `modifyVideo`, `modifyVideoElement`,
    `setVolumeIfChanged`, `setPlaybackRateIfChanged`,
    `setVolumeOfPreviouslySeenVideoElements`,
    `setPlaybackRateOfPreviouslySeenVideoElements`,
    `redefineWebkitMediaControlHidingCssRule`, `knownVideoElements`.
12. Port `style.css` with renamed classes/data attributes.
13. Create `content/index.ts` — `defineContentScript({ allFrames: true,
matches: ["https://*.instagram.com/*"], cssInjectionMode: "manifest",
runAt: "document_end" })` whose `main()` wires up storage subscription
    and the MutationObserver.

**Verify C:**

- Load `instagram.com/reels/<any>` — native HTML5 controls visible with
  seek bar, fullscreen, PiP.
- Adjust volume on one video → reload → volume restored.
- Open a story → controls visible, "Send Message" box does not overlay
  controls.
- Embed an IG video in a third-party page (e.g. CodePen iframe) —
  controls also appear (verifies `allFrames: true`).

### Phase D — Wheel hotkeys

14. Create `wheel-hotkeys.ts` per §5 sketch. Import from `content/index.ts`
    `main()` after the observer is set up.

**Verify D:**

- Hover any IG video, `Ctrl + scroll up` → playback speed increases by
  0.25 (snapped to step); `Ctrl + scroll down` → decreases. Page does not
  zoom.
- Hover video, hold right mouse button, scroll up → volume increases;
  context menu **does not** appear when releasing RMB after scrolling.
- Right-click without scrolling → context menu still works normally.
- Scrolling without `Ctrl` or RMB → page scrolls normally.

### Phase E — Polish + release rehearsal

15. Write `README.md` (§11).
16. `bun run check` (ultracite) — fix any issues with `bun run fix`.
17. `bun run typecheck` — must pass.
18. `bun run zip:all` — must produce
    `.output/ig-video-controls-0.0.0-chrome.zip` and
    `.output/ig-video-controls-0.0.0-firefox.zip`.
19. Smoke-test the Firefox build: `bun run dev:firefox` and verify the
    same as Phase C/D on Firefox.
20. Create initial changeset (`.changeset/initial-rewrite.md` per §8).
21. **Delete `temp/` directory** (per gitignore it shouldn't be tracked,
    but remove from working tree since reference is no longer needed).
22. **Delete `PLAN.md`** (or move to `docs/PLAN.md` if you want to keep it).
23. Delete this repo's existing `index.ts` (it's a placeholder).

### Phase F — Post-execution (user manual steps)

24. `bun run gen-key` → records the persistent extension ID; commit
    `key.pem` **only to the GitHub secret**, never to git.
25. Push to `github.com/mynameistito/ig-video-controls`.
26. Confirm first release PR is opened by Changesets bot; merge it; verify
    the second workflow run uploads both zips as a `v0.1.0` release.

---

## 13 — Behaviour that is intentionally NOT ported

For the record, so the implementer doesn't accidentally re-add them:

- `chrome.commands` keyboard shortcuts.
- The disabled / commented-out mute-button-sync block (lines ~150-181 of
  `InstagramVideoControls.js`).
- `ErrorStackParser` + `Stackframe` (only fed `recordUsageStats`).
- `recordUsageStats`, `recordEx`, `watchEx`, `getFunctionName`,
  `augmentFunctionName`, `FloodTracker`.
- `recordInstall`, `updateUninstallUrl`, `setUninstallURL`,
  `buildUrlRespectingMaxLength`, `countErrors`.
- `appVersionHistory`, `initialAppInstallTime`, `mostRecentUpdateTime`,
  `usageStats` storage keys.
- Options page (`options.html`, `options.js`) and the
  `playback-speed-gui.png` screenshot.
- `update_url`, `key` field copied from the original manifest, the
  `_metadata/` directory.
- The `showLog` debug toggle and `log()` wrapper — replaced with plain
  `console.debug` calls gated by `import.meta.env.DEV` if needed.

---

## 14 — Open risks / things to watch during port

- Instagram's DOM changes constantly. The button-finder heuristics (SVG
  path matching, bottom-third positioning) are inherently brittle — port
  them faithfully but don't refactor for "cleanliness", because the
  heuristics ARE the value.
- `cssInjectionMode: "manifest"` means our CSS file is listed in the
  manifest's `content_scripts.css`. WXT will produce the right manifest
  for both Chrome and Firefox.
- Firefox does not honour `controlsList`, but it also does not strip the
  download button, so the line `videoPlayer.setAttribute('controlsList',
'')` is harmless on Firefox — keep it as-is.
- WXT's `defineBackground` produces a service-worker manifest on Chrome
  and an event-page on Firefox automatically — no per-browser logic
  required.
- Right-mouse + wheel may behave differently on Linux/Trackpad. Behaviour
  is best-effort; document the supported gestures in README.

# ig-video-controls

Adds the native HTML5 video player (seek bar, volume slider, fullscreen, PiP) to Instagram videos, remembers your volume and playback speed across tabs and sessions, and provides mouse-wheel hotkeys for quick adjustments.

Originally based on [Controls for Instagram Videos](https://chromewebstore.google.com/detail/controls-for-instagram-vi/eigfbedabacomcacemdnkelnlhgbiacn) by [rehfeld.us](https://rehfeld.us). This is a complete rewrite; all telemetry / uninstall analytics removed, and browser agnostic.

## Hotkeys

| Gesture | Action |
| --- | --- |
| `Ctrl + Mousewheel` over a video | Speed up / down (± 0.25×) |
| Hold Right Mouse Button + `Mousewheel` over a video | Volume up / down (± 0.1) |

Right-click without scrolling still works normally — the context menu is only suppressed when you actually scroll while holding RMB.

## development

```bash
bun install
```

## Persistent extension ID (Chrome)

Chrome assigns a random extension ID on each build unless an RSA key is embedded in the manifest. Generate one locally:

```bash
# Run from the workspace root.
bun run generate-keys -- --app ig-video-controls
```

The root-level script creates this app's gitignored `key.pem`, prints the stable Chromium extension ID, and prints the command to configure `IG_VIDEO_CONTROLS_WXT_CHROME_KEY` in the workspace repository. Do not commit or share `key.pem`; use `--force` only when intentionally changing the extension ID.

```
Get-Content apps/ig-video-controls/key.pem -Raw | gh secret set IG_VIDEO_CONTROLS_WXT_CHROME_KEY --repo mynameistito/browser-extensions
```

## Commands

| Command                 | Description                        |
| ----------------------- | ---------------------------------- |
| `bun run dev`           | Dev mode (Chrome)                  |
| `bun run dev:firefox`   | Dev mode (Firefox)                 |
| `bun run build`         | Production build (Chrome)          |
| `bun run build:firefox` | Production build (Firefox)         |
| `bun run zip`           | Zip for Chrome Web Store           |
| `bun run zip:firefox`   | Zip for AMO                        |
| `bun run zip:all`       | Zip both browsers                  |
| `bun run typecheck`     | Type-check with `tsc`              |
| `bun run check`         | Lint + format check (Ultracite)    |
| `bun run fix`           | Auto-fix lint + format (Ultracite) |

## Release

This app is versioned and released from the `browser-extensions` monorepo with [Changesets](https://github.com/changesets/changesets) + GitHub Actions. See the workspace root README for the release flow.

## License

[MIT](LICENSE)

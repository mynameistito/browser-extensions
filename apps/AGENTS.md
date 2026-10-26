# APP WORKSPACE MAP

## OVERVIEW

Each child directory is an independently versioned app. Eight are WXT browser extensions; `web/` is the Blume documentation site and has its own Cloudflare Worker deployment.

## WHERE TO LOOK

| App | Main purpose / architecture |
| --- | --- |
| `better-history/` | React history/search UI with background enforcement, routes, and domain features; see its local `AGENTS.md`. |
| `github-settings-repo-copy/` | Small GitHub settings content script. |
| `hide-email-ext/` | Email redaction content script, popup, background, and `src/lib/`. |
| `hide-ip-ext/` | IP masking content script with background messaging. |
| `ig-video-controls/` | Modular Instagram video content script; see its local `AGENTS.md`. |
| `mute-tab-manager/` | Cross-browser tab muting with YouTube player synchronization. |
| `new-tab-ext/` | Local-first React dashboard; see its existing local `AGENTS.md`. |
| `quote-viewer/` | X quote-viewer content script and tweet helpers. |
| `web/` | Blume documentation site for all extensions; deploys to Cloudflare Workers through Alchemy. |

## CONVENTIONS

- Use each app's own `package.json` for supported commands; script availability varies by package.
- Run shared WXT wrapper scripts from an app package (workspace scripts already do this); the wrapper takes its working directory as the WXT project root.
- Respect the app's configured WXT source root. Root-level `entrypoints/` and `src/entrypoints/` layouts both occur.
- Keep app dependencies and release versions local to the app. Root workspace membership is defined by `apps/*`.
- `web/` is not a WXT app: do not add it to WXT preparation or browser-extension artifact release steps. Its production deployment is gated on its Changesets version bump.
- `postinstall` generally runs WXT `prepare` to generate app-local types; avoid hand-editing generated `.wxt/` files.

## ANTI-PATTERNS

- Do not copy path aliases, entrypoint placement, local lint config, or test assumptions from one app into another without checking its config.
- Do not assume root Turbo tasks run a check that the app does not declare.

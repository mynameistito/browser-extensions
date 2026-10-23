# INSTAGRAM VIDEO CONTROLS MAP

## OVERVIEW

WXT extension centered on a content script that adds native-style controls and hotkeys to Instagram video players.

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Content-script orchestration | `src/entrypoints/content/index.ts` | Coordinates the feature modules. |
| Player discovery / DOM | `src/entrypoints/content/button-finder.ts`, `dom.ts` | Locate controls and interact with changing page DOM. |
| Playback controls / overlay | `src/entrypoints/content/video-controls.ts`, `video-osd.ts`, `overlay-fixes.ts` | Player behavior and on-screen display. |
| Settings / hotkeys | `src/entrypoints/content/settings.ts`, `wheel-hotkeys.ts` | Preferences and wheel-based control. |
| Shared defaults/math | `src/lib/` | Pure helpers and default values. |
| Background entry | `src/entrypoints/background.ts` | Extension background initialization. |

## CONVENTIONS

- Keep DOM/player concerns in the content modules; preserve the entrypoint as the integration point for those modules.
- Instagram's page DOM is external and dynamic. Prefer resilient discovery and narrowly scoped DOM changes over assumptions about fixed markup.
- Keep reusable pure calculations in `src/lib/` rather than coupling them to browser globals.
- This package currently has no `test` script; do not assume `bun run test` exercises it. Use its declared `check`, `typecheck`, and build scripts.

## COMMANDS

Run from this app directory or target it from the root with Turbo:

```text
bun run dev
bun run build
bun run check
bun run typecheck
```

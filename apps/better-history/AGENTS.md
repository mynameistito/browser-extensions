# BETTER HISTORY MAP

## OVERVIEW

Multi-surface WXT extension: React popup/history pages, background logic, and domain-focused UI features.

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| WXT entrypoints | `src/entrypoints/` | Background, popup, and full-page history entry files. |
| File-based routes | `src/routes/` | TanStack Router route modules. |
| Route registration | `src/routeTree.gen.ts` | Generated from routes; do not edit by hand. |
| User-facing domain features | `src/features/` | `history/`, `domains/`, and `cleanup/`. |
| Browser/storage integration | `src/lib/` | Browser API, schemas, storage, patterns, ranges, and typed errors. |
| Background behaviors | `src/background/` | Install, enforcement, context menus, and action handling. |
| Localized strings | `src/public/_locales/<locale>/messages.json` | Keep locale message keys aligned. |

## CONVENTIONS

- Keep UI feature logic in the corresponding `src/features/<domain>/`; shared browser and persistence boundaries belong in `src/lib/`.
- Route files use TanStack Router conventions; update routes and regenerate the route tree through the project's normal tooling rather than editing generated output.
- Validate stored/message data through the schemas and typed error abstractions in `src/lib/` instead of duplicating parsing at UI call sites.
- Tests use Vitest (`bun run test`) and are colocated under `__tests__/` at the app root.

## COMMANDS

Run from this app directory or target it from the root with Turbo:

```text
bun run dev
bun run build
bun run typecheck
bun run test
```

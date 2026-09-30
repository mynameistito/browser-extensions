# New Tab

A local-first browser new-tab dashboard built with WXT, React, and Effect.

## Development

Install dependencies with Bun:

```sh
bun install
```

Run the extension in Chrome/Chromium:

```sh
bun run dev
```

Run it in Firefox:

```sh
bun run dev:firefox
```

## Checks and builds

```sh
bun run typecheck
bun run test
bun run check
bun run build
bun run zip
```

`build` and `zip` produce both Chromium and Firefox outputs. Use `build:chrome`, `build:firefox`, `zip:chrome`, or `zip:firefox` for one browser.

## Changesets

Create a release note for user-visible changes with:

```sh
bun run changeset
```

For a non-interactive changeset, use:

```sh
bun run changeset-add minor "Add dashboard search actions"
```

# New Tab

A local-first browser new-tab dashboard built with WXT, React, and Effect. Run the commands below from `apps/new-tab-ext` unless noted otherwise.

## Development

Install workspace dependencies from the repository root:

```sh
bun install
```

Start the extension in Chrome or Chromium:

```sh
bun run dev
```

Or start it in Firefox:

```sh
bun run dev:firefox
```

## Persistent Chrome extension ID

Chromium derives an extension ID from its manifest key. To keep the same ID across local builds, generate a private key from the workspace root:

```sh
# Run from the workspace root.
bun run generate-keys -- --app new-tab-ext
```

The root-level script writes this app's gitignored `key.pem`, prints the derived extension ID, and prints the command to register the key as the `NEW_TAB_WXT_CHROME_KEY` GitHub Actions secret. Do not commit or share `key.pem`. Push builds on `init` require that secret and use it only for Chrome builds; pull-request builds do not receive it. Firefox uses the fixed Gecko ID in `wxt.config.ts` and does not need this Chrome key. Do not use `--force` unless you intend to change the Chrome extension ID.

## Checks and builds

```sh
bun run typecheck
bun run test
bun run check
bun run build
bun run zip
```

`build` and `zip` produce outputs for both Chromium and Firefox. To target one browser, use `build:chrome`, `build:firefox`, `zip:chrome`, or `zip:firefox`.

## Changesets

Create a release note for user-visible changes with:

```sh
bun run changeset
```

For a non-interactive changeset, run this command from `apps/new-tab-ext`:

```sh
bun run changeset-add minor "Add dashboard search actions"
```

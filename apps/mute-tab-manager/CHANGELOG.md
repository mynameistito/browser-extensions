# mute-tab-manager

## 1.0.8

### Patch Changes

- 683625a: Retry the Firefox releases for Mute Tab Manager and Quote Viewer now that source archive generation is fixed.

## 1.0.7

### Patch Changes

- 6392514: feat: publish Mute Tab Manager and Quote Viewer releases to Firefox Add-ons

## 1.0.6

### Patch Changes

- 0930ed4: Trigger a patch release for every app to test the release CI/CD pipeline.

## 1.0.5

### Patch Changes

- e368b09: Include an app-specific source archive in extension releases.

## 1.0.4

### Patch Changes

- f21c5da: Enforce 95% V8 coverage thresholds for the app source and expand behavioral test coverage.
- 4b98c31: Run the test suite with Vitest and align its checks with the shared lint rules.

## 1.0.3

### Patch Changes

- bb0dd5f: Harden mute-state handling and report background failures
- 8f601f1: Move Mute Tab Manager into the monorepo release pipeline

## 1.0.2

### Patch Changes

- a8b16fc: Fix extension manifest metadata so builds use the Mute Tab Manager name and description.

## 1.0.1

### Major Changes

- Update to major to be aligned with the Firefox published extension.

### Patch Changes

- 8984b46: biomejs/biome -> oxlint/oxfmt migration in [PR #59](https://github.com/mynameistito/mute-tab-manager/pull/59)
- d1820ba: Use native TypeScript preview and standardize internal imports on path aliases
- d6830f3: Fix the Chrome signing key workflow so releases use WXT's expected secret name and local key generation is safer by default.

  - Rename the GitHub Actions signing key secret from `EXTENSION_KEY_PEM` to `WXT_CHROME_KEY` and update the release workflow validation/error messaging to match.
  - Change `bun run generate-key` to create a fresh local `key.pem` with `openssl`, refuse to overwrite an existing key unless `--force`/`-f` is passed, and print the derived Chromium extension ID plus the matching `gh secret set WXT_CHROME_KEY` command.
  - Stop regenerating and committing `extension-key.json`; the derived public key metadata is no longer kept in the repo, and the previously committed key metadata has been removed.
  - Update README signing-key docs and command references to document `WXT_CHROME_KEY`, the safer default generation behavior, and the explicit force flag for extension ID rotation.
  - Update Extension ID

- 23d577f: Fix Knip configuration for WXT entrypoints
- e1f3296: Harden and align the release pipeline.

## 0.5.0

### Minor Changes

- e6e0cf9: updating adding the correct changeset.

### Patch Changes

- f8eabaf: WXT-based single-codebase rewrite. One TypeScript source tree builds Chrome MV3 and Firefox MV3 extensions via WXT. Adds persistent Chrome extension ID via generated RSA private key. Ultracite + Changesets + GitHub Actions CI/release + Lefthook + Bun test suite using happy-dom and a Chrome API mock.

## 0.4.2

### Minor Changes

- Initial WXT-based single-codebase rewrite. One TypeScript source tree builds Chrome MV3 and Firefox MV3 extensions via WXT. Adds persistent Chrome extension ID via a generated RSA private key (`key.pem`) and the derived `manifestKey` embedded in the Chrome manifest. Ships with Ultracite (Biome), Changesets, GitHub Actions CI + release, Lefthook pre-commit hooks, and a Bun-powered test suite using happy-dom and a Chrome API mock.

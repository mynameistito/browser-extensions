# hide-email-ext

## 0.3.5

### Patch Changes

- 456c2c3: Remove obsolete package-local release scripts; the shared release and Changesets tooling remain available.
- e368b09: Include an app-specific source archive in extension releases.

## 0.3.4

### Patch Changes

- 1bc3e8b: fix(hide-email-ext): subscribe before initial storage read
- 35794a5: Blur matched emails with a click-to-reveal toggle
- 34be681: Add a Firefox extension ID and explicitly target Manifest V3.
- 1407ab8: Run the test suite with Vitest and align its checks with the shared lint rules.
- 163b479: fix(hide-email-ext): serialize concurrent email-list updates
- b4989cf: Restore page content when configured redaction addresses are removed or cleared.
- e97e91e: Require comprehensive V8 coverage and test popup failure and interaction behavior.

## 0.3.3

### Patch Changes

- f7e28a8: Republish after the skipped release workflow run.

## 0.3.2

### Patch Changes

- 8f8a5ac: Prepare hide-email-ext for its next publish.
- 4a71266: Refresh package metadata and shared tooling dependencies across all extensions.

## 0.3.1

### Patch Changes

- 7acdaa2: bump pkgs

## 0.3.0

### Minor Changes

- 23796fc: Improve extension release automation and packaging reliability.

  The WXT manifest now derives the Chromium `manifest.key` from `WXT_CHROME_KEY` in CI or local `key.pem` during development, only injects that key for Chromium builds, and fails release builds when `REQUIRE_CHROME_KEY=1` is set without a stable key source. This prevents accidental Chrome releases with a random extension ID while keeping local builds usable.

  Release tooling has been consolidated around `scripts/release.ts`, with `ci:release` delegating to `release`. The release workflow now uses the Changesets action only for version PR creation, then runs the project release script when publishing is needed. The release script validates check, typecheck, `bun test`, and Knip before building Chrome and Firefox packages, zipping each target, then uploading both artifacts to the GitHub release. Package scripts now include explicit test, Chrome zip, Firefox zip, and combined zip commands.

  The key generator now creates a PKCS8 RSA key with `openssl`, refuses accidental overwrites unless `--force` is passed, prints the derived Chromium extension ID, and prints the matching `gh secret set WXT_CHROME_KEY` command for configuring GitHub Actions.

  CI now runs typecheck, `bun test`, Ultracite, build, and Knip as separate matrix tasks. Bun tests were added covering email normalization/validation, DOM email redaction (including skipped tags, attributes, idle-callback and timeout fallbacks, and DOMContentLoaded rescan), extension storage, and shared types. A bun test preload (`tests/setup.ts`, wired via `bunfig.toml`) installs happy-dom DOM globals and the WXT `fakeBrowser` so content-script and storage tests run under Bun. Knip was added as a package script, unused messaging/types code was removed, entrypoints were included in TypeScript analysis, and imports were adjusted so Knip, TypeScript, and WXT resolve the same modules.

  Icon assets were moved from `public/icon-*.png` to WXT's default `public/icon/<size>.png` layout, and the manifest icon paths were updated to match.

  The non-interactive changeset helper was renamed from `scripts/add-changeset.ts` to `scripts/changeset-add.ts`, and the `changeset-add` package script now points at the new path.

## 0.2.3

### Patch Changes

- 85842a2: Update development tooling packages and fix Ultracite lint issues.

## 0.2.2

### Patch Changes

- 6a9f061: Suppress Firefox `data_collection_permissions` build warning in WXT config. Update `changesets/action` to v1.8.0 to fix deprecated `set-output` GitHub Actions warnings. Bump `actions/checkout` to v6 and `actions/cache` to v5.

## 0.2.1

### Patch Changes

- 27c2c9b: Fix release workflow — replace npm publish with GitHub release CI

## 0.2.0

### Minor Changes

- 305835a: Initial release of Hide Email extension

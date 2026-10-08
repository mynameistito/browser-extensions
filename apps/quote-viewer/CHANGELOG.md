# quote-viewer

## 0.2.10

### Patch Changes

- [`c8c0089`](https://github.com/mynameistito/quote-viewer/commit/c8c0089): Update `@changesets/cli`, `@types/bun`, `lefthook`, `oxfmt`, `oxlint`, `ultracite`, and `wxt`.

## 0.2.9

### Patch Changes

- [`295a593`](https://github.com/mynameistito/quote-viewer/commit/295a593): Hide X's native View quotes links when rendering custom quote buttons

## 0.2.8

### Patch Changes

- [`8a92b7e`](https://github.com/mynameistito/quote-viewer/commit/8a92b7e): Fix the Chrome signing key workflow so releases use WXT's expected secret name and local key generation is safer by default.

  - Rename the GitHub Actions signing key secret from `EXTENSION_KEY_PEM` to `WXT_CHROME_KEY` and update the release workflow validation/error messaging to match.
  - Change `bun run generate-key` to create a fresh local `key.pem` with `openssl`, refuse to overwrite an existing key unless `--force`/`-f` is passed, and print the derived Chromium extension ID plus the matching `gh secret set WXT_CHROME_KEY` command.
  - Stop regenerating and committing `extension-key.json`; the derived public key metadata is no longer kept in the repo, and the previously committed key metadata has been removed.
  - Update README signing-key docs and command references to document `WXT_CHROME_KEY`, the safer default generation behavior, and the explicit force flag for extension ID rotation.
  - Update Extension ID

  **NOTE: This will make it appear as a new extension on Chrome**

## 0.2.7

### Patch Changes

- [`1a63052`](https://github.com/mynameistito/quote-viewer/commit/1a63052): Harden and align the release pipeline.

## 0.2.6

### Patch Changes

- [`24f0fc9`](https://github.com/mynameistito/quote-viewer/commit/24f0fc9): Add Bun test coverage for quote viewer behavior
- [`ce74f52`](https://github.com/mynameistito/quote-viewer/commit/ce74f52): Use aliased imports for extension source files

## 0.2.5

### Patch Changes

- [`6ba8be7`](https://github.com/mynameistito/quote-viewer/commit/6ba8be7): - Bump Packages:

  - ↑ @typescript/native-preview 7.0.0-dev.20260524.1 → 7.0.0-dev.20260616.1
  - ↑ lefthook 2.1.8 → 2.1.9
  - ↑ oxfmt 0.51.0 → 0.55.0
  - ↑ oxlint 1.66.0 → 1.70.0
  - ↑ ultracite 7.7.0 → 7.8.3

  - Fixed up Ultracite issues that arose with new ultracite rules.
  - Fixes up Miasma Mini Shai-Hulud Supply Chain Attack in development env

- [`a14d001`](https://github.com/mynameistito/quote-viewer/commit/a14d001): Fix quote icon color to match Twitter's native action bar icon color

## 0.2.4

### Patch Changes

- [`462872b`](https://github.com/mynameistito/quote-viewer/commit/462872b): Bump Firefox `strict_min_version` from `109.0` to `140.0` so AMO no longer warns that the previously-required `data_collection_permissions` key is unsupported by the declared minimum version (it was added in Firefox 140). Firefox-only change; Chrome manifest is unchanged. The extension is not targeted at Firefox for Android, so the equivalent Android warning is intentionally not addressed.

## 0.2.3

### Patch Changes

- [`5a54f30`](https://github.com/mynameistito/quote-viewer/commit/5a54f30): Fix Firefox AMO validation issues:
  - Add required `browser_specific_settings.gecko.data_collection_permissions` (set to `["none"]`) to the Firefox manifest.
  - Resolve "Unsafe assignment to innerHTML" warning by building the quote-icon SVG via `createElementNS` instead of assigning an HTML string to `innerHTML`.

## 0.2.2

### Patch Changes

- [`03c49b4`](https://github.com/mynameistito/quote-viewer/commit/03c49b4): Remove popup, background script, and on-install tab. The extension no longer has any popup or action-on-click behavior.

## 0.2.1

### Patch Changes

- [`9dfad14`](https://github.com/mynameistito/quote-viewer/commit/9dfad14): Fix icon showing gray box without hover and white circle on hover, fix pending-article retry missing nested action bars

## 0.2.0

### Minor Changes

- [`768e468`](https://github.com/mynameistito/quote-viewer/commit/768e468): Open x.com instead of twitter.com on extension install

### Patch Changes

- [`cdbbea1`](https://github.com/mynameistito/quote-viewer/commit/cdbbea1): Fix quote icon not appearing on timeline and profile pages

## 0.1.5

### Patch Changes

- [`51fc23e`](https://github.com/mynameistito/quote-viewer/commit/51fc23e): Update CICD Release Script and Pipeline

## 0.1.4

### Patch Changes

- [`182ae19`](https://github.com/mynameistito/quote-viewer/commit/182ae19): Collapse the release pipeline into a single CI step. `bun run release` now chains `zip:all && changeset tag && publish-release`, so `changesets/action` runs the whole release end-to-end (build + tag + GitHub Release with assets). Removes the separate "Create GitHub Release with extension zips" step from the workflow and the brittle coordination between it and the action's `published` output. Also passes `--target $GITHUB_SHA` to `gh release create` so the tag is created server-side without needing runner git-push credentials.

## 0.1.3

### Patch Changes

- [`d416731`](https://github.com/mynameistito/quote-viewer/commit/d416731): Disable `changesets/action`'s default `createGithubReleases: true` so it no longer races our `publish-release` step by creating an empty (and, under GitHub Immutable Releases, unmodifiable) release first. Our script now owns release creation and atomically attaches the chrome + firefox zips.

  For robustness, `scripts/publish-release.ts` also now deletes a pre-existing release for the same tag and recreates it with assets, since Immutable Releases blocks in-place edits. Also adds a manual `Upload Release Assets` workflow to backfill historical releases (e.g. v0.1.1, v0.1.2) using the same delete-then-recreate flow.

## 0.1.2

### Patch Changes

- [`f816276`](https://github.com/mynameistito/quote-viewer/commit/f816276): Fix `scripts/publish-release.ts` failing to find built extension zips. `Bun.Glob.scan` defaults to `dot: false`, which skipped the `.output/` directory because it starts with a dot. Pass `dot: true` so the `.output/*.zip` glob matches the chrome and firefox bundles produced by `wxt zip`.

## 0.1.1

### Patch Changes

- [`2ae9d9f`](https://github.com/mynameistito/quote-viewer/commit/2ae9d9f): Fix release workflow so GitHub Releases include the built Chrome and Firefox extension zips.

  Replaces the broken `createGithubReleases: true` + separate upload steps with a single `scripts/publish-release.ts` (exposed as `bun run publish-release`) that creates the release with the `.output/*.zip` assets attached, or uploads to an existing release on re-run.

## 0.1.0

### Minor Changes

- [`36ae54d`](https://github.com/mynameistito/quote-viewer/commit/36ae54d): Initial rewrite of original Chrome extension.

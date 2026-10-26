# Browser Extensions

Eight independent WXT browser extensions and their Blume documentation site, maintained in one Bun/Turborepo workspace.

## Apps

| App | Description |
| --- | --- |
| [`hide-email-ext`](apps/hide-email-ext) | Redacts selected email addresses on web pages. |
| [`quote-viewer`](apps/quote-viewer) | Restores a View Quotes action on X. |
| [`new-tab-ext`](apps/new-tab-ext) | A local-first browser new-tab dashboard. |
| [`hide-ip-ext`](apps/hide-ip-ext) | Blurs your public IP address on web pages. |
| [`ig-video-controls`](apps/ig-video-controls) | Adds native HTML5 video controls to Instagram videos. |
| [`better-history`](apps/better-history) | Powerful browser history search, filtering, and cleanup. |
| [`github-settings-repo-copy`](apps/github-settings-repo-copy) | Copies the repository name from GitHub settings confirmation dialogs. |
| [`mute-tab-manager`](apps/mute-tab-manager) | Mutes browser tabs and synchronizes YouTube player audio. |
| [`web`](apps/web) | User documentation for every extension. |

## Setup

Install [Bun](https://bun.sh/) and run `bun install` followed by `bun run prepare:wxt` from the repository root. The prepare step generates each WXT app's local types and is safe to rerun.

Run a command across all apps with `bun run build`, `bun run test`, or `bun run typecheck`. To target one app, use Turbo filters, for example: `bunx turbo run build --filter=hide-email-ext`.

Each app remains independently versioned. Create a Changeset for the package that changed with `bun run changeset`, or use `bun run changeset-add <app> <patch|minor|major> "summary"`. Extension releases get app-prefixed GitHub tags and Chrome/Firefox artifacts. `web` is versioned with Changesets but deploys separately to Cloudflare Workers after its version bump is merged; it is not part of the extension ZIP release flow. Mute Tab Manager's former standalone repository is retired; its canonical source is now [`apps/mute-tab-manager`](apps/mute-tab-manager).

Generate persistent Chromium signing keys from the repository root with `bun run generate-keys`. This creates a separate gitignored `key.pem` in each app that uses a persistent Chrome key. To generate only one app's key, use `bun run generate-keys -- --app quote-viewer`. Existing keys are never overwritten unless `--force` is passed. By default, the command prints the `gh secret set` command using that app's secret in the release workflow. It targets `mynameistito/browser-extensions` unless `--repo owner/name` is supplied. Add `--upload` to send the key to GitHub directly (requires `gh` authentication). Repo overrides and uploads require a single `--app` target.

Run `bun run generate-keys --help` for all options and examples.

## Repository layout

```text
apps/       WXT extensions and the Blume documentation site
scripts/    Shared Node.js tooling scripts
```

Lint/format configuration is centralized in the root `oxlint.config.ts` and `oxfmt.config.ts`. The new-tab app adds its React/TanStack-specific Oxlint presets in its local config while inheriting the same Ultracite core. All project TypeScript configs inherit shared compiler options from the root `tsconfig.base.json`.

Before enabling automated Chrome releases, add these repository Actions secrets, each containing that extension's own PEM key: `BETTER_HISTORY_WXT_CHROME_KEY`, `HIDE_EMAIL_WXT_CHROME_KEY`, `QUOTE_VIEWER_WXT_CHROME_KEY`, `NEW_TAB_WXT_CHROME_KEY`, `IG_VIDEO_CONTROLS_WXT_CHROME_KEY`, `WXT_GITHUB_SETTINGS_REPO_COPY_CHROME_KEY`, and `MUTE_TAB_MANAGER_WXT_CHROME_KEY`. `hide-ip-ext` does not currently use a persistent Chrome key.

The web deployment workflow also requires `CLOUDFLARE_ACCOUNT_ID` and a narrowly scoped `CLOUDFLARE_API_TOKEN` repository secret. Its Alchemy stack uses `browser-ext.mynameistito.com` in production and creates per-PR Worker previews.

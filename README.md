# Browser Extensions

Eight independently versioned WXT browser extensions and a Blume documentation site, maintained in one Bun and Turborepo workspace.

## Extensions and apps

| App | What it does |
| --- | --- |
| [`hide-email-ext`](apps/hide-email-ext) | Redacts selected email addresses on web pages. |
| [`quote-viewer`](apps/quote-viewer) | Restores a “View Quotes” action on X. |
| [`new-tab-ext`](apps/new-tab-ext) | Provides a local-first new-tab dashboard. |
| [`hide-ip-ext`](apps/hide-ip-ext) | Blurs your public IP address on web pages. |
| [`ig-video-controls`](apps/ig-video-controls) | Adds native HTML5 video controls to Instagram videos. |
| [`better-history`](apps/better-history) | Searches, filters, and cleans up browser history. |
| [`github-settings-repo-copy`](apps/github-settings-repo-copy) | Copies repository names from GitHub settings confirmation dialogs. |
| [`mute-tab-manager`](apps/mute-tab-manager) | Mutes browser tabs and synchronizes YouTube player audio. |
| [`web`](apps/web) | Hosts user documentation for the extensions. |

## Get started

Install [Bun](https://bun.sh/) and run these commands from the repository root:

```sh
bun install
bun run prepare:wxt
```

The prepare step generates each WXT app's local types and is safe to rerun.

## Workspace commands

Run common tasks across the workspace:

```sh
bun run build
bun run test
bun run typecheck
```

To run a task for one app, use a Turbo filter. For example:

```sh
bunx turbo run build --filter=hide-email-ext
```

## Versioning and releases

Each app is independently versioned. Create a Changeset for the package you changed:

```sh
bun run changeset
# Or create one non-interactively:
bun run changeset-add <app> <patch|minor|major> "summary"
```

Extension releases use app-prefixed GitHub tags and include Chrome and Firefox artifacts. The `web` app is also versioned with Changesets, but deploys separately to Cloudflare Workers after its version bump is merged; it is not part of the extension ZIP release flow.

Mute Tab Manager's former standalone repository is retired. Its canonical source is [`apps/mute-tab-manager`](apps/mute-tab-manager).

## Persistent Chromium keys

Generate signing keys from the repository root:

```sh
bun run generate-keys
```

The command creates a separate, gitignored `key.pem` for each app that uses a persistent Chrome key. To generate a key for only one app:

```sh
bun run generate-keys -- --app quote-viewer
```

Existing keys are never overwritten unless you pass `--force`. By default, the command prints the `gh secret set` command for the app's release secret. It targets `mynameistito/browser-extensions`; use `--repo owner/name` to choose another repository. Add `--upload` to upload the key directly to GitHub (requires `gh` authentication). Repository overrides and uploads require a single `--app` target.

For all options and examples, run `bun run generate-keys --help`.

## Repository layout and tooling

```text
apps/       WXT extensions and the Blume documentation site
scripts/    Shared Node.js tooling scripts
```

Lint and format configuration lives in the root `oxlint.config.ts` and `oxfmt.config.ts`. The new-tab app adds React and TanStack-specific Oxlint presets in its local config while inheriting the shared Ultracite core. All project TypeScript configs inherit compiler options from the root `tsconfig.base.json`.

## Release secrets

Before enabling automated Chrome releases, add a repository Actions secret for each extension that uses a persistent key. Each secret must contain that extension's own PEM key:

- `BETTER_HISTORY_WXT_CHROME_KEY`
- `HIDE_EMAIL_WXT_CHROME_KEY`
- `QUOTE_VIEWER_WXT_CHROME_KEY`
- `NEW_TAB_WXT_CHROME_KEY`
- `IG_VIDEO_CONTROLS_WXT_CHROME_KEY`
- `WXT_GITHUB_SETTINGS_REPO_COPY_CHROME_KEY`
- `MUTE_TAB_MANAGER_WXT_CHROME_KEY`

`hide-ip-ext` does not currently use a persistent Chrome key.

The web deployment workflow also requires the `CLOUDFLARE_ACCOUNT_ID` and a narrowly scoped `CLOUDFLARE_API_TOKEN` repository secret. Its Alchemy stack deploys to `browser-ext.mynameistito.com` in production and creates per-PR Worker previews.

# Browser Extensions

Independent WXT browser extensions maintained in one Bun/Turborepo workspace.

## Apps

| App | Description |
| --- | --- |
| [`hide-email-ext`](apps/hide-email-ext) | Redacts selected email addresses on web pages. |
| [`quote-viewer`](apps/quote-viewer) | Restores a View Quotes action on X. |
| [`new-tab-ext`](apps/new-tab-ext) | A local-first browser new-tab dashboard. |
| [`hide-ip-ext`](apps/hide-ip-ext) | Blurs your public IP address on web pages. |

## Setup

Install [Bun](https://bun.sh/) and run `bun install` followed by `bun run prepare:wxt` from the repository root. The prepare step generates each WXT app's local types and is safe to rerun.

Run a command across all apps with `bun run build`, `bun run test`, or `bun run typecheck`. To target one app, use Turbo filters, for example: `bunx turbo run build --filter=hide-email-ext`.

Each app remains independently versioned and released. Create a Changeset for the app package that changed with `bun run changeset`, or use `bun run changeset-add <app> <patch|minor|major> "summary"`. For example: `bun run changeset-add quote-viewer patch "Fix quote button on profile pages"`. Each release gets an app-prefixed GitHub tag and app-specific Chrome/Firefox artifacts.

Generate persistent Chromium signing keys from the repository root with `bun run generate-keys`. This creates a separate gitignored `key.pem` in each app that uses a persistent Chrome key. To generate only one app's key, use `bun run generate-keys -- --app quote-viewer`. Existing keys are never overwritten unless `--force` is passed. The command prints each extension ID and the command to register its key as the `WXT_CHROME_KEY` GitHub Actions secret.

## Repository layout

```text
apps/       Independently buildable WXT extensions
packages/   Shared tooling and configuration packages
```

Lint/format configuration is centralized in the root `oxlint.config.ts` and `oxfmt.config.ts`. The new-tab app adds its React/TanStack-specific Oxlint presets in its local config while inheriting the same Ultracite core. The shared TypeScript base lives in `packages/typescript-config`.

Before enabling automated Chrome releases, add a `WXT_CHROME_KEY` repository Actions secret in each app repository, containing that extension's own PEM key. `hide-ip-ext` does not currently use a persistent Chrome key.

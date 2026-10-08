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

Install [Bun](https://bun.sh/) and run `bun install` from the repository root.

Run a command across all apps with `bun run build`, `bun run test`, or
`bun run typecheck`. To target one app, use Turbo filters, for example:
`bunx turbo run build --filter=hide-email-ext`.

Each app remains independently versioned and released. Create a Changeset for
the app package that changed with `bun run changeset`; release workflows build
and attach that app's browser artifacts.

## Repository layout

```text
apps/       Independently buildable WXT extensions
packages/   Shared tooling and configuration packages
```

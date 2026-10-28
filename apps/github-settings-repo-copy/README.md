# GitHub Settings Repo Copy

A small browser extension that makes the `owner/repo` text in GitHub repository confirmation dialogs copyable. It runs only on GitHub repository pages and does not send or store repository data.

## Development and builds

Run these commands from `apps/github-settings-repo-copy`:

| Command               | Description                                      |
| --------------------- | ------------------------------------------------ |
| `bun run dev`         | Start the Chromium development build.            |
| `bun run dev:firefox` | Start the Firefox development build.             |
| `bun run build`       | Build for Chromium and Firefox.                  |
| `bun run zip:all`     | Create distributable archives for both browsers. |

Install workspace dependencies first with `bun install` from the repository root.

## Persistent Chromium ID

To keep the Chromium extension ID stable across builds and releases, generate a key from the repository root:

```sh
bun run generate-keys -- --app github-settings-repo-copy
```

The command prints the GitHub Actions secret to configure. Keep the generated `key.pem` private and do not commit it.

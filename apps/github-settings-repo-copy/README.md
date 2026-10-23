# GitHub Settings Repo Copy

A browser extension that makes the `owner/repo` text in GitHub repository confirmation dialogs copyable. It runs only on GitHub repository pages and does not send or store repository data.

## Development

- `bun run dev` starts the Chromium development build.
- `bun run dev:firefox` starts the Firefox development build.
- `bun run build` builds for Chromium and Firefox.
- `bun run zip:all` creates distributable archives for both browsers.

To create the persistent Chromium extension ID used for releases, run `bun run generate-keys --app github-settings-repo-copy` from the repository root, then add the printed GitHub Actions secret.

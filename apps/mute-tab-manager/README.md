# Mute Tab Manager

Mute and unmute tabs across Chrome and Firefox, including YouTube player audio.

## Features

- Toggle mute from the toolbar or with `Alt+Shift+M`.
- Mute all tabs from the toolbar context menu.
- Directly mute YouTube video elements, persisting across SPA navigation and reloads.
- Show an `M` badge on muted tabs and adapt the icon to system dark mode.
- Keep muted state for the current browser session.

## Development and checks

Run commands from the repository root. Install dependencies, then generate WXT types:

```sh
bun install
bun run --filter mute-tab-manager postinstall
```

Start a development build or run checks with:

```sh
bun run --filter mute-tab-manager dev
bun run --filter mute-tab-manager dev:firefox
bun run --filter mute-tab-manager build
bun run --filter mute-tab-manager test
bun run --filter mute-tab-manager typecheck
```

WXT can create development-only Chrome builds without a persistent signing key. Before publishing, generate a stable key from the repository root:

```sh
bun run generate-keys -- --app mute-tab-manager
```

Add the printed secret to the `MUTE_TAB_MANAGER_WXT_CHROME_KEY` Actions secret. Never commit `key.pem`.

Each app is independently versioned and released through Changesets. Create a patch changeset from the repository root with:

```sh
bun run changeset-add mute-tab-manager patch "Describe the change"
```

The monorepo release workflow publishes Chrome and Firefox archives on GitHub.

## Permissions

The extension uses `activeTab`, `tabs`, `contextMenus`, and `storage` for tab mute controls and session state. Chrome additionally uses `offscreen` for dark mode detection. YouTube host access is used to synchronize the player UI with the tab's mute state.

## License

MIT — see [LICENSE](LICENSE).

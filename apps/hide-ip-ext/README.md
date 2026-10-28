# Hide IP Extension

Hide IP is a WXT browser extension that fetches your public IP address and blurs matching text on visited pages. Hover over a blurred address to reveal it; move away to hide it again. The extension also redacts the address in browser-tab titles and `title` tooltips.

## Get started

From the repository root, install dependencies and generate WXT types:

```bash
bun install
bun run prepare:wxt
```

Then run the app commands from `apps/hide-ip-ext`:

```bash
bun run dev
bun run build
```

The build writes Manifest V3 extensions to `.output/chrome-mv3` and `.output/firefox-mv3`. To try the Chrome build, load `apps/hide-ip-ext/.output/chrome-mv3` as an unpacked extension in a Chromium browser. For Firefox, load `apps/hide-ip-ext/.output/firefox-mv3/manifest.json` through `about:debugging#/runtime/this-firefox`.

## Persistent Chrome extension ID

Generate a persistent signing key from the workspace root:

```bash
bun run generate-keys -- --app hide-ip-ext
```

This writes the gitignored `apps/hide-ip-ext/key.pem`, prints the stable Chrome extension ID, and shows how to configure the `HIDE_IP_WXT_CHROME_KEY` GitHub Actions secret. Add `--upload` to upload the key directly; if `key.pem` already exists, the command uploads it without rotating the key:

```bash
bun run generate-keys -- --app hide-ip-ext --upload
```

Keep `key.pem` private and do not commit it. Use `--force` only when intentionally changing the Chrome extension ID. Firefox uses the fixed Gecko ID in `wxt.config.ts` and does not use this Chrome signing key.

## Privacy

- The extension requests your public address from `browser-ext.mynameistito.com/api/v1/ip` and caches it in memory for 15 minutes.
- It scans page text only for that exact address. It does not collect page content or send it anywhere.
- It leaves text in inputs and textareas unchanged so it does not interfere with typing.

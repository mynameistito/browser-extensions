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

The build writes Chrome and Firefox extensions to `.output/chrome-mv3` and `.output/firefox-mv2`. To try the Chrome build, load `apps/hide-ip-ext/.output/chrome-mv3` as an unpacked extension in a Chromium browser.

## Privacy

- The extension requests your public address from `browser-ext.mynameistito.com/api/v1/ip` and caches it in memory for 15 minutes.
- It scans page text only for that exact address. It does not collect page content or send it anywhere.
- It leaves text in inputs and textareas unchanged so it does not interfere with typing.

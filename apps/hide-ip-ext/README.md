# Hide IP Extension

Hide IP Extension is a WXT browser extension that fetches your public IP address and blurs matching text on every visited page. Hover over a blurred IP to reveal it; moving away redacts it again. It also redacts the matching address in browser-tab titles and `title` tooltips.

## Run it

From the workspace root, install dependencies and generate the WXT types:

```bash
bun install
bun run prepare:wxt
```

Then run the app scripts from `apps/hide-ip-ext`:

```bash
bun run dev
bun run build
```

The build creates Chrome and Firefox extensions in `.output/chrome-mv3` and `.output/firefox-mv2`. Load `apps/hide-ip-ext/.output/chrome-mv3` as an unpacked extension in a Chromium browser.

## Privacy notes

- The extension requests the public address from `browser-ext.mynameistito.com/api/v1/ip` and caches it in memory for 15 minutes.
- It only scans page text for that exact address. It does not collect page content or send it anywhere.
- Text inside inputs and textareas is deliberately left alone so it does not interfere with typing.

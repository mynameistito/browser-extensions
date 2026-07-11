# Hide IP Extension

Hide IP Extension is a WXT browser extension that fetches your public IP address and blurs matching text on every visited page. Hover over a blurred IP to reveal it; moving away redacts it again. It also redacts the matching address in browser-tab titles and `title` tooltips.

## Run it

```bash
npm install
npm run dev
```

For a production build, run `npm run build`. Load the generated `dist/chrome-mv3` folder as an unpacked extension in a Chromium browser.

## Privacy notes

- The extension requests the public address from `api.ipify.org` and caches it in memory for 15 minutes.
- It only scans page text for that exact address. It does not collect page content or send it anywhere.
- Text inside inputs and textareas is deliberately left alone so it does not interfere with typing.

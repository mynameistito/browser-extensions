import { defineContentScript } from "#imports";
import {
  cleanStatusAddressBarUrl,
  cleanStatusUrl,
  patchClipboardWriter,
} from "@/lib/clean-status-url";

export default defineContentScript({
  main() {
    cleanStatusAddressBarUrl(window.history, window.location.href);

    const { clipboard } = navigator;

    if (clipboard === undefined) {
      return;
    }

    patchClipboardWriter(clipboard);

    let sharedStatusUrl = window.location.href;

    document.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof Element)) {
          return;
        }

        const shareButton = event.target.closest(
          'button[aria-label="Share post"]'
        );

        if (shareButton !== null) {
          const article = shareButton.closest("article");

          const statusLink = article?.querySelector<HTMLAnchorElement>(
            'a[href*="/status/"]'
          );

          sharedStatusUrl = statusLink?.href ?? window.location.href;

          return;
        }

        const menuItem = event.target.closest('[role="menuitem"]');

        if (menuItem?.textContent?.trim() !== "Copy link") {
          return;
        }

        const cleanUrl = cleanStatusUrl(sharedStatusUrl);

        // X can retain a native clipboard method before our wrapper is installed.
        // Re-write after its click handler so the clean URL wins either way.
        const writeCleanUrl = async () => {
          try {
            await clipboard.writeText(cleanUrl);
          } catch {
            console.warn("X Copy Cleaner could not write a clean link.");
          }
        };

        queueMicrotask(() => {
          writeCleanUrl().catch(() => null);
        });
      },
      true
    );
  },
  matches: [
    "https://twitter.com/*",
    "https://www.twitter.com/*",
    "https://x.com/*",
    "https://www.x.com/*",
  ],
  runAt: "document_start",
  world: "MAIN",
});

import { defineContentScript } from "#imports";
import { patchClipboardWriter } from "@/lib/clean-status-url";

export default defineContentScript({
  main() {
    const { clipboard } = navigator;

    if (clipboard === undefined) {
      return;
    }

    patchClipboardWriter(clipboard);
  },
  matches: ["https://twitter.com/*", "https://x.com/*"],
  runAt: "document_start",
  world: "MAIN",
});

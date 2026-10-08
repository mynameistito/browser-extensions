import { defineContentScript } from "#imports";
import { setupQuoteViewer } from "@/entrypoints/content/dom";

import "@/entrypoints/content/style.css";

export default defineContentScript({
  cssInjectionMode: "manifest",
  main() {
    console.log("view quoted tweets extension: setting up observer");
    setupQuoteViewer();
  },
  matches: ["https://twitter.com/*", "https://x.com/*"],
});

import { defineContentScript } from "#imports";
import { setupQuoteViewer } from "@/entrypoints/content/dom";

import "@/entrypoints/content/style.css";

export default defineContentScript({
  cssInjectionMode: "manifest",
  main(context) {
    console.log("view quoted tweets extension: setting up observer");
    const observer = setupQuoteViewer();
    context.onInvalidated(() => {
      observer.disconnect();
    });
  },
  matches: ["https://twitter.com/*", "https://x.com/*"],
});

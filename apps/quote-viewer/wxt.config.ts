import { defineConfig } from "wxt";

import { loadChromeExtensionConfig } from "../../scripts/chrome-extension-config";

export default defineConfig({
  manifest: ({ browser }) => {
    const base = {
      description:
        "Bringing back view quote tweets to Twitter(now known as X) Web",
      name: "View Quote Tweets On Twitter - quote-viewer",
    };

    if (browser === "firefox") {
      return {
        ...base,
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: { required: ["none"] },
            id: "quote-viewer@mynameistito.com",
            strict_min_version: "140.0",
          },
        },
      };
    }

    const key = loadChromeExtensionConfig(import.meta.dirname)?.manifestKey;
    return {
      ...base,
      ...(key ? { key } : {}),
    };
  },
  outDir: ".output",
  srcDir: "src",
});

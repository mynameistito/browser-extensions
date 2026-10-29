import { existsSync, readFileSync } from "node:fs";

import { defineConfig } from "wxt";

import { deriveChromeExtensionKey } from "../../scripts/chrome-extension-key";

const loadManifestKey = (): string | undefined => {
  const pem =
    process.env.WXT_CHROME_KEY ??
    (existsSync("key.pem") ? readFileSync("key.pem", "utf-8") : undefined);

  return pem === undefined || pem.length === 0
    ? undefined
    : deriveChromeExtensionKey(pem).manifestKey;
};

export default defineConfig({
  manifest: ({ browser }) => {
    const base = {
      description:
        "Automatically removes tracking parameters from copied X post links.",
      name: "X Copy Cleaner",
    };

    if (browser === "firefox") {
      return {
        ...base,
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: { required: ["none"] },
            id: "x-copy-cleaner@mynameistito.com",
            strict_min_version: "140.0",
          },
        },
      };
    }

    const key = loadManifestKey();

    return key === undefined || key.length === 0 ? base : { ...base, key };
  },
  manifestVersion: 3,
  outDir: ".output",
  srcDir: "src",
});

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "wxt";

import { deriveChromeExtensionKey } from "../../scripts/chrome-extension-key";

const loadManifestKey = (): string | undefined => {
  const environmentPem = process.env.WXT_CHROME_KEY;

  if (environmentPem !== undefined && environmentPem.length > 0) {
    return deriveChromeExtensionKey(environmentPem).manifestKey;
  }

  const keyPath = path.resolve(import.meta.dirname, "key.pem");

  if (!existsSync(keyPath)) {
    if (process.env.REQUIRE_CHROME_KEY === "1") {
      throw new Error(
        "WXT_CHROME_KEY or key.pem is required for release builds."
      );
    }

    console.warn(
      "[wxt] key.pem not found and WXT_CHROME_KEY is unset - Chrome extension ID will be random. Run `bun run generate-keys -- --app hide-ip-ext` from the workspace root."
    );

    return undefined;
  }

  return deriveChromeExtensionKey(readFileSync(keyPath, "utf-8")).manifestKey;
};

export default defineConfig({
  manifest: ({ browser }) => {
    const base = {
      description:
        "Keeps your public IP address hidden on web pages until you intentionally reveal it.",
      host_permissions: ["https://browser-ext.mynameistito.com/*"],
      name: "IP Veil",
      permissions: ["storage"],
    };

    if (browser === "firefox") {
      return {
        ...base,
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: { required: ["none"] },
            id: "hide-ip-ext@mynameistito.com",
          },
        },
      };
    }

    const key = loadManifestKey();

    return key === undefined ? base : { ...base, key };
  },
  manifestVersion: 3,
});

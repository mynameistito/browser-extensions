import { existsSync, readFileSync } from "node:fs";

import { defineConfig } from "wxt";

import { deriveChromeExtensionKey } from "../../scripts/chrome-extension-key";

const getManifestKey = (): string | undefined => {
  const pem =
    process.env.WXT_CHROME_KEY ??
    (existsSync("key.pem") ? readFileSync("key.pem", "utf-8") : undefined);

  if (pem === undefined || pem.length === 0) {
    return undefined;
  }

  try {
    return deriveChromeExtensionKey(pem).manifestKey;
  } catch (error) {
    console.error("Failed to derive Chrome extension key:", error);

    if (
      process.env.REQUIRE_CHROME_KEY !== undefined &&
      process.env.REQUIRE_CHROME_KEY.length > 0
    ) {
      throw error;
    }

    return undefined;
  }
};

export default defineConfig({
  manifest: ({ browser }) => {
    const base = {
      description:
        "Copy owner/repo from GitHub repository confirmation dialogs.",
      host_permissions: ["https://github.com/*"],
      name: "GitHub Settings Repo Copy",
      permissions: ["clipboardWrite"],
    };

    if (browser === "firefox") {
      return {
        ...base,
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: { required: ["none"] },
            id: "github-settings-repo-copy@mynameistito.com",
          },
        },
      };
    }

    const key = getManifestKey();

    const manifest: typeof base & { key?: string } = { ...base };

    if (key !== undefined && key.length > 0) {
      manifest.key = key;
    }

    return manifest;
  },
  manifestVersion: 3,
  outDir: ".output",
  srcDir: ".",
});

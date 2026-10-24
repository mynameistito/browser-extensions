import { createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "wxt";

const extractManifestKey = (pem: string): string =>
  createPublicKey(pem)
    .export({ format: "pem", type: "spki" })
    .replaceAll("-----BEGIN PUBLIC KEY-----", "")
    .replaceAll("-----END PUBLIC KEY-----", "")
    .replaceAll(/\s+/gu, "");

const loadManifestKey = (): string | undefined => {
  const environmentKey = process.env.WXT_CHROME_KEY;

  if (environmentKey !== undefined && environmentKey.length > 0) {
    return extractManifestKey(environmentKey);
  }

  const keyPath = path.resolve("key.pem");

  if (!existsSync(keyPath)) {
    return undefined;
  }

  return extractManifestKey(readFileSync(keyPath, "utf-8"));
};

export default defineConfig({
  manifest: ({ browser }) => {
    const base = {
      action: {
        default_icon: {
          128: "icons/icon-128.png",
          16: "icons/icon-16.png",
          48: "icons/icon-48.png",
        },
        default_title: "Toggle Mute",
      },
      commands: {
        "toggle-mute": {
          description: "Toggle mute for the active tab",
          suggested_key: { default: "Alt+Shift+M" },
        },
      },
      description:
        "Mute and unmute tabs across Chrome and Firefox with YouTube support.",
      host_permissions: ["*://*.youtube.com/*"],
      icons: {
        128: "icons/icon-128.png",
        16: "icons/icon-16.png",
        48: "icons/icon-48.png",
      },
      name: "Mute Tab Manager",
      permissions: ["activeTab", "tabs", "contextMenus", "storage"],
    };

    if (browser === "firefox") {
      return {
        ...base,
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: { required: ["none"] },
            id: "mute-tab-manager@mynameistito.com",
            strict_min_version: "140.0",
          },
        },
      };
    }

    const key = loadManifestKey();

    if (key !== undefined && key.length > 0) {
      return {
        ...base,
        key,
        permissions: [...base.permissions, "offscreen"],
      };
    }

    return {
      ...base,
      permissions: [...base.permissions, "offscreen"],
    };
  },
  manifestVersion: 3,
  outDir: ".output",
  srcDir: "src",
});

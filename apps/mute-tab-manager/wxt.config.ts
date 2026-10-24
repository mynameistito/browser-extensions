import { createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "wxt";

const loadManifestKey = (): string | undefined => {
  const environmentKey = process.env.WXT_CHROME_KEY;
  const pem =
    typeof environmentKey === "string" && environmentKey.length > 0
      ? environmentKey
      : (() => {
          const keyPath = path.resolve("key.pem");
          return existsSync(keyPath)
            ? readFileSync(keyPath, "utf-8")
            : undefined;
        })();

  if (typeof pem !== "string" || pem.length === 0) {
    return undefined;
  }

  return createPublicKey(pem)
    .export({ format: "pem", type: "spki" })
    .toString()
    .replaceAll("-----BEGIN PUBLIC KEY-----", "")
    .replaceAll("-----END PUBLIC KEY-----", "")
    .replaceAll(/\s+/gu, "");
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
    return {
      ...base,
      ...(typeof key === "string" && key.length > 0 ? { key } : {}),
      permissions: [...base.permissions, "offscreen"],
    };
  },
  manifestVersion: 3,
  outDir: ".output",
  srcDir: "src",
});

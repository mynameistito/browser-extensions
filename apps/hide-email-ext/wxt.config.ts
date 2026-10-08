import { readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "wxt";

import { loadChromeExtensionConfig } from "../../scripts/chrome-extension-config";

const pkg = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8")
) as { version: string };

export default defineConfig({
  manifest: ({ browser }) => {
    const base = {
      action: {
        default_icon: {
          "128": "icon/128.png",
          "16": "icon/16.png",
          "32": "icon/32.png",
          "48": "icon/48.png",
        },
        default_popup: "popup/index.html",
      },
      description: "Redacts user-specified email addresses on every page.",
      host_permissions: ["<all_urls>"],
      icons: {
        "128": "icon/128.png",
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
        "96": "icon/96.png",
      },
      name: "Hide Email",
      permissions: ["storage"],
      version: pkg.version,
    };

    if (browser === "firefox") {
      return base;
    }

    const key = loadChromeExtensionConfig(import.meta.dirname)?.manifestKey;

    return {
      ...base,
      ...(key ? { key } : {}),
    };
  },
  srcDir: ".",
  suppressWarnings: {
    firefoxDataCollection: true,
  },
});

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "wxt";

import { deriveChromeExtensionKey } from "../../scripts/chrome-extension-key";
import pkg from "./package.json";

/**
 * Derive the Chromium-compatible `manifest.key` (base64 SPKI public key) from
 * the local `key.pem` or CI-provided `WXT_CHROME_KEY` private-key PEM so local
 * and release builds keep the same persistent Chromium extension ID.
 */
/** Loads the private key from the environment or app root.
 * @returns The PEM text when available.
 */
const loadPemSource = (): string | undefined => {
  const fromEnv = process.env.WXT_CHROME_KEY;

  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }

  const keyPath = path.resolve(import.meta.dirname, "key.pem");

  if (existsSync(keyPath)) {
    return readFileSync(keyPath, "utf-8");
  }

  return undefined;
};

const loadManifestKey = (): string | undefined => {
  const pem = loadPemSource();

  if (pem === undefined) {
    return undefined;
  }

  return deriveChromeExtensionKey(pem).manifestKey;
};

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
      description:
        "Blurs selected emails and optionally masks IPv4 and IPv6 addresses on every page.",
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
      return {
        ...base,
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: { required: ["none"] },
            id: "hide-email-ext@mynameistito.com",
          },
        },
      };
    }

    const key = loadManifestKey();

    if (key === undefined || key.length === 0) {
      if (process.env.REQUIRE_CHROME_KEY === "1") {
        throw new Error(
          "WXT_CHROME_KEY or key.pem is required when REQUIRE_CHROME_KEY=1."
        );
      }

      console.warn(
        "[wxt] key.pem not found and WXT_CHROME_KEY is unset - extension ID will be random. Run `bun run generate-keys -- --app hide-email-ext` from the workspace root."
      );
    }

    const manifest: typeof base & { key?: string } = { ...base };

    if (key !== undefined && key.length > 0) {
      manifest.key = key;
    }

    return manifest;
  },
  manifestVersion: 3,
  srcDir: ".",
  suppressWarnings: {
    firefoxDataCollection: true,
  },
});

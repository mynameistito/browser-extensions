import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

import { deriveChromeExtensionKey } from "../../scripts/chrome-extension-key";

const loadChromePrivateKey = (): string | undefined => {
  const keyFromEnvironment = process.env.WXT_CHROME_KEY?.trim();

  if (keyFromEnvironment !== undefined && keyFromEnvironment.length > 0) {
    return keyFromEnvironment;
  }

  const localKeyPath = path.resolve("key.pem");

  return existsSync(localKeyPath)
    ? readFileSync(localKeyPath, "utf-8")
    : undefined;
};

/** Builds the browser-specific extension manifest.
 * @param browser - The target browser for the manifest.
 * @returns The extension manifest for the selected browser.
 */
export const createManifest = (browser: string) => {
  const base = {
    description: "A customizable, local-first new-tab dashboard.",
    host_permissions: [
      "https://api.open-meteo.com/*",
      "https://geocoding-api.open-meteo.com/*",
      "https://commons.wikimedia.org/*",
    ],
    name: "New Tab",
    permissions: ["storage"],
  };

  if (browser === "firefox") {
    return {
      ...base,
      browser_specific_settings: {
        gecko: {
          data_collection_permissions: { required: ["none"] },
          id: "new-tab-ext@mynameistito.com",
        },
      },
      content_security_policy:
        "script-src 'self'; object-src 'self'; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://commons.wikimedia.org; img-src 'self' data: https://thumb.wikimedia.org",
    };
  }

  const privateKey = loadChromePrivateKey();

  const contentSecurityPolicy = {
    extension_pages:
      "script-src 'self'; object-src 'self'; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://commons.wikimedia.org; img-src 'self' data: https://thumb.wikimedia.org",
  };

  if (privateKey !== undefined && privateKey.length > 0) {
    return {
      ...base,
      content_security_policy: contentSecurityPolicy,
      key: deriveChromeExtensionKey(privateKey).manifestKey,
    };
  }

  return { ...base, content_security_policy: contentSecurityPolicy };
};

/** Creates the Vite plugin configuration for the extension.
 * @returns The configured Vite plugins.
 */
export const createViteConfig = () => ({
  plugins: [tailwindcss()],
});

export default defineConfig({
  manifest: ({ browser }) => createManifest(browser),
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  vite: createViteConfig,
});

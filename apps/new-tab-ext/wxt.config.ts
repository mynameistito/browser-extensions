import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

import { deriveChromeExtensionKey } from "./scripts/chrome-extension-key";

const loadChromePrivateKey = (): string | undefined => {
  const keyFromEnvironment = process.env.WXT_CHROME_KEY?.trim();

  if (keyFromEnvironment) {
    return keyFromEnvironment;
  }

  const localKeyPath = path.resolve("key.pem");
  return existsSync(localKeyPath)
    ? readFileSync(localKeyPath, "utf-8")
    : undefined;
};

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: ({ browser }) => {
    const base = {
      name: "New Tab",
      description: "A customizable, local-first new-tab dashboard.",
      permissions: ["storage"],
      host_permissions: [
        "https://api.open-meteo.com/*",
        "https://geocoding-api.open-meteo.com/*",
        "https://commons.wikimedia.org/*",
      ],
    };

    if (browser === "firefox") {
      return {
        ...base,
        content_security_policy:
          "script-src 'self'; object-src 'self'; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://commons.wikimedia.org; img-src 'self' data: https://thumb.wikimedia.org",
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: { required: ["none"] },
            id: "new-tab-ext@mynameistito.com",
          },
        },
      };
    }

    const privateKey = loadChromePrivateKey();

    const contentSecurityPolicy = {
      extension_pages:
        "script-src 'self'; object-src 'self'; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://commons.wikimedia.org; img-src 'self' data: https://thumb.wikimedia.org",
    };

    if (privateKey) {
      return {
        ...base,
        key: deriveChromeExtensionKey(privateKey).manifestKey,
        content_security_policy: contentSecurityPolicy,
      };
    }

    return { ...base, content_security_policy: contentSecurityPolicy };
  },
});

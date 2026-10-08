import { createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "wxt";

/**
 * Derive the Chromium-compatible `manifest.key` (base64 SPKI public key) from
 * the local `key.pem` (PKCS8 private key) so the extension always resolves to
 * the same persistent ID locally.
 *
 * - In dev / local builds we read `key.pem` from the repo root.
 * - In CI we accept `WXT_CHROME_KEY` as the raw private-key PEM (from a secret).
 * - Only injected for Chromium targets — Firefox uses `browser_specific_settings`.
 */
const loadPemSource = (): string | undefined => {
  const fromEnv = process.env.WXT_CHROME_KEY;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  const keyPath = path.resolve("key.pem");
  if (existsSync(keyPath)) {
    return readFileSync(keyPath, "utf-8");
  }
};

const loadManifestKey = (): string | undefined => {
  const pem = loadPemSource();
  if (!pem) {
    return;
  }

  const spkiPem = createPublicKey(pem).export({
    format: "pem",
    type: "spki",
  }) as string;

  return spkiPem
    .replaceAll("-----BEGIN PUBLIC KEY-----", "")
    .replaceAll("-----END PUBLIC KEY-----", "")
    .replaceAll(/\s+/gu, "");
};

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

    const key = loadManifestKey();
    return {
      ...base,
      ...(key ? { key } : {}),
    };
  },
  outDir: ".output",
  srcDir: "src",
});

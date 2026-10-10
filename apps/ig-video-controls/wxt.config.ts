import { createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig } from "wxt";

const loadPemSource = (): string | undefined => {
  const fromEnv = process.env.WXT_CHROME_KEY;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  const keyPath = resolve("key.pem");
  if (existsSync(keyPath)) {
    try {
      return readFileSync(keyPath, "utf-8");
    } catch (error) {
      console.error(`Failed to read ${keyPath}:`, (error as Error).message);
    }
  }
};

const loadManifestKey = (): string | undefined => {
  const pem = loadPemSource();
  if (!pem) {
    return;
  }

  let spkiPem: string;
  try {
    spkiPem = createPublicKey(pem).export({
      format: "pem",
      type: "spki",
    }) as string;
  } catch (error) {
    console.error("Failed to parse PEM into SPKI:", (error as Error).message);
    return undefined;
  }

  return spkiPem
    .replaceAll("-----BEGIN PUBLIC KEY-----", "")
    .replaceAll("-----END PUBLIC KEY-----", "")
    .replaceAll(/\s+/gu, "");
};

export default defineConfig({
  manifest: ({ browser }) => {
    const base = {
      description:
        "Adds the native HTML5 player (seek bar, volume, fullscreen, PiP) to Instagram videos, plus Ctrl+wheel speed and RMB+wheel volume hotkeys.",
      homepage_url: "https://github.com/mynameistito/ig-video-controls",
      name: "Instagram Video Controls",
      permissions: ["storage"],
      short_name: "ig-vid-ctrls",
    };

    if (browser === "firefox") {
      return {
        ...base,
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: { required: ["none"] },
            id: "ig-video-controls@mynameistito.com",
            strict_min_version: "140.0",
          },
        },
      };
    }

    const key = loadManifestKey();
    return {
      ...base,
      ...(key ? { key } : {}),
      minimum_chrome_version: "88",
    };
  },
  outDir: ".output",
  srcDir: "src",
});

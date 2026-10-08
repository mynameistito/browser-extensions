import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { PluginOption } from "vite";
import { afterEach, describe, expect, test } from "vitest";

import config from "../../wxt.config";

const originalDirectory = process.cwd();
const originalChromeKey = process.env.WXT_CHROME_KEY;
interface BrowserConfigEnv {
  readonly browser: "chrome" | "firefox";
  readonly command: "build" | "serve";
  readonly mode: string;
  readonly manifestVersion: number;
}

// SAFETY: wxt.config.ts supplies this callback, and this test invokes it with the complete WXT config environment.
const manifestCallback = config.manifest as (
  env: BrowserConfigEnv
) => object | Promise<object>;
// SAFETY: wxt.config.ts supplies a Vite callback with the same complete config environment.
const viteCallback = config.vite as
  | ((env: BrowserConfigEnv) => { readonly plugins: PluginOption[] })
  | undefined;

const getManifest = async (browser: "chrome" | "firefox") =>
  await manifestCallback({
    browser,
    command: "build",
    mode: "test",
    manifestVersion: 3,
  });

afterEach(() => {
  process.chdir(originalDirectory);
  if (originalChromeKey === undefined) {
    Reflect.deleteProperty(process.env, "WXT_CHROME_KEY");
  } else {
    process.env.WXT_CHROME_KEY = originalChromeKey;
  }
});

describe("WXT browser configuration", () => {
  test("configures Firefox identity and common permissions", async () => {
    const manifest = await getManifest("firefox");

    expect(manifest).toHaveProperty("name", "New Tab");
    expect(manifest).toHaveProperty(
      "permissions",
      expect.arrayContaining(["storage"])
    );
    expect(manifest).toHaveProperty(
      "browser_specific_settings.gecko.id",
      "new-tab-ext@mynameistito.com"
    );
    expect(manifest).toHaveProperty(
      "content_security_policy",
      expect.stringContaining("script-src 'self'")
    );
  });

  test("uses the configured environment key and exposes the Vite plugin", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" },
    });
    process.env.WXT_CHROME_KEY = privateKey;
    const manifest = await getManifest("chrome");

    expect(manifest).toHaveProperty("key");
    expect(
      viteCallback?.({
        browser: "chrome",
        command: "serve",
        mode: "test",
        manifestVersion: 3,
      })
    ).toHaveProperty("plugins");
  });

  test("uses the local key when the environment key is blank", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "wxt-local-key-test-"));
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" },
    });
    process.chdir(directory);
    process.env.WXT_CHROME_KEY = "   ";
    writeFileSync("key.pem", privateKey);

    try {
      const manifest = await getManifest("chrome");
      expect(manifest).toHaveProperty("key");
    } finally {
      process.chdir(originalDirectory);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("omits the manifest key when neither environment nor local key exists", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "wxt-config-test-"));
    process.chdir(directory);
    process.env.WXT_CHROME_KEY = "";

    try {
      const manifest = await getManifest("chrome");
      expect(manifest).not.toHaveProperty("key");
    } finally {
      process.chdir(originalDirectory);
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

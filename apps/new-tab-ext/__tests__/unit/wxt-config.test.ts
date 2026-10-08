import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { PluginOption } from "vite";
import { afterEach, describe, expect, test, vi } from "vitest";

import config from "../../wxt.config";

const originalDirectory = process.cwd();
const originalChromeKey = process.env.WXT_CHROME_KEY;
const originalRequireKey = process.env.REQUIRE_CHROME_KEY;
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
  if (originalRequireKey === undefined) {
    Reflect.deleteProperty(process.env, "REQUIRE_CHROME_KEY");
  } else {
    process.env.REQUIRE_CHROME_KEY = originalRequireKey;
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

  test("enforces the shared required-key behavior only for Chromium", async () => {
    process.env.WXT_CHROME_KEY = " ";
    process.env.REQUIRE_CHROME_KEY = "1";

    await expect(getManifest("chrome")).rejects.toThrow(
      "WXT_CHROME_KEY or key.pem is required when REQUIRE_CHROME_KEY=1."
    );
    expect(await getManifest("firefox")).toHaveProperty(
      "browser_specific_settings.gecko.id",
      "new-tab-ext@mynameistito.com"
    );
  });

  test("omits the manifest key when neither environment nor local key exists", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "wxt-config-test-"));
    process.chdir(directory);
    process.env.WXT_CHROME_KEY = "";
    process.env.REQUIRE_CHROME_KEY = "0";
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const manifest = await getManifest("chrome");
      expect(manifest).not.toHaveProperty("key");
      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining("extension ID will be unstable")
      );
    } finally {
      warning.mockRestore();
      process.chdir(originalDirectory);
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

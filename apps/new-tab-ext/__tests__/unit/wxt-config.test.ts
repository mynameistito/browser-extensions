import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import config, { createManifest, createViteConfig } from "../../wxt.config";
import {
  cleanupTestEnvironment,
  setupTestEnvironment,
} from "../helpers/test-environment";

const originalDirectory = process.cwd();
const { WXT_CHROME_KEY: originalChromeKey } = process.env;

const getManifest = (browser: "chrome" | "firefox") => createManifest(browser);

describe("WXT browser configuration", () => {
  beforeEach(setupTestEnvironment);

  afterEach(() => {
    cleanupTestEnvironment();
    process.chdir(originalDirectory);

    if (originalChromeKey === undefined) {
      Reflect.deleteProperty(process.env, "WXT_CHROME_KEY");
    } else {
      process.env.WXT_CHROME_KEY = originalChromeKey;
    }
  });

  it("configures Firefox identity and common permissions", () => {
    const manifest = getManifest("firefox");

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

  it("delegates WXT manifest generation to the browser config", () => {
    expect(config.manifest).toStrictEqual(expect.any(Function));
    expect(createManifest("firefox")).toHaveProperty(
      "browser_specific_settings.gecko.id",
      "new-tab-ext@mynameistito.com"
    );
  });

  it("uses the configured environment key and exposes the Vite plugin", () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" },
    });

    process.env.WXT_CHROME_KEY = privateKey;
    const manifest = getManifest("chrome");

    expect(manifest).toHaveProperty("key");
    expect(createViteConfig()).toHaveProperty("plugins");
  });

  it("uses the local key when the environment key is blank", () => {
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
      const manifest = getManifest("chrome");
      expect(manifest).toHaveProperty("key");
    } finally {
      process.chdir(originalDirectory);
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("omits the manifest key when neither environment nor local key exists", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "wxt-config-test-"));
    process.chdir(directory);
    process.env.WXT_CHROME_KEY = "";

    try {
      const manifest = getManifest("chrome");
      expect(manifest).not.toHaveProperty("key");
    } finally {
      process.chdir(originalDirectory);
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

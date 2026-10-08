import { afterEach, describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { loadChromeExtensionConfig } from "../chrome-extension-config";
import { deriveChromeExtensionKey } from "../chrome-extension-key";

const originalDirectory = process.cwd();
const originalChromeKey = process.env.WXT_CHROME_KEY;
const originalRequireKey = process.env.REQUIRE_CHROME_KEY;
const temporaryDirectories: string[] = [];

const createAppDirectory = (appName = "new-tab-ext") => {
  const root = mkdtempSync(path.join(tmpdir(), "chrome-config-test-"));
  temporaryDirectories.push(root);
  const appDirectory = path.join(root, appName);
  mkdirSync(appDirectory);
  return appDirectory;
};

const createKey = () =>
  generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
  }).privateKey;

const fail = (message: string): never => {
  throw new Error(`injected: ${message}`);
};

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
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("loadChromeExtensionConfig", () => {
  test("prefers a trimmed environment key over the app-local key", () => {
    const appDirectory = createAppDirectory();
    const environmentKey = createKey();
    const localKey = createKey();
    writeFileSync(path.join(appDirectory, "key.pem"), localKey);

    const loaded = loadChromeExtensionConfig(appDirectory, {
      env: { WXT_CHROME_KEY: `  ${environmentKey}  ` },
    });

    expect(loaded).toEqual(deriveChromeExtensionKey(environmentKey));
    expect(loaded).not.toEqual(deriveChromeExtensionKey(localKey));
  });

  test("loads key.pem relative to the app directory, not the process CWD", () => {
    const appDirectory = createAppDirectory("quote-viewer");
    const privateKey = createKey();
    writeFileSync(path.join(appDirectory, "key.pem"), privateKey);
    const elsewhere = mkdtempSync(path.join(tmpdir(), "chrome-cwd-test-"));
    temporaryDirectories.push(elsewhere);

    try {
      process.chdir(elsewhere);
      expect(loadChromeExtensionConfig(appDirectory, { env: {} })).toEqual(
        loadChromeExtensionConfig(appDirectory, {
          env: { WXT_CHROME_KEY: privateKey },
        })
      );
    } finally {
      process.chdir(originalDirectory);
    }
  });

  test("warns consistently and returns undefined when the optional key is missing", () => {
    const warnings: string[] = [];
    const result = loadChromeExtensionConfig(createAppDirectory(), {
      env: {},
      warn: (message) => warnings.push(message),
    });

    expect(result).toBeUndefined();
    expect(warnings).toEqual([
      "[wxt] Chrome signing key not found; the extension ID will be unstable. Run `bun run generate-keys -- --app new-tab-ext` from the workspace root.",
    ]);
  });

  test("fails through the injected error seam when a required key is missing", () => {
    expect(() =>
      loadChromeExtensionConfig(createAppDirectory(), {
        env: { REQUIRE_CHROME_KEY: "1" },
        fail,
      })
    ).toThrow("injected: WXT_CHROME_KEY or key.pem is required");
  });

  test("derives the same identity for the same PEM", () => {
    const appDirectory = createAppDirectory();
    const privateKey = createKey();

    expect(
      loadChromeExtensionConfig(appDirectory, {
        env: { WXT_CHROME_KEY: privateKey },
      })
    ).toEqual(deriveChromeExtensionKey(privateKey));
  });
});

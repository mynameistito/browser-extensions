import { describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";

import { assertRequiredChromeExtensionKey } from "../chrome-extension-key";

const validPrivateKeyPem = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { format: "pem", type: "pkcs8" },
  publicKeyEncoding: { format: "pem", type: "spki" },
}).privateKey;

describe("assertRequiredChromeExtensionKey", () => {
  test("accepts a valid required release key", () => {
    expect(() => {
      assertRequiredChromeExtensionKey(validPrivateKeyPem, true);
    }).not.toThrow();
  });

  test("rejects a missing required release key", () => {
    expect(() => {
      assertRequiredChromeExtensionKey(undefined, true);
    }).toThrow("WXT_CHROME_KEY is required");
  });

  test("rejects a malformed required release key", () => {
    expect(() => {
      assertRequiredChromeExtensionKey("invalid PEM", true);
    }).toThrow("WXT_CHROME_KEY must contain a valid Chrome private key");
  });

  test("preserves optional local build behavior", () => {
    expect(() => {
      assertRequiredChromeExtensionKey("invalid PEM", false);
    }).not.toThrow();
  });
});

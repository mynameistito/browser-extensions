import { generateKeyPairSync } from "node:crypto";

import { it, describe, expect } from "vitest";

import { assertRequiredChromeExtensionKey } from "../chrome-extension-key";

const validPrivateKeyPem = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { format: "pem", type: "pkcs8" },
  publicKeyEncoding: { format: "pem", type: "spki" },
}).privateKey;

describe(assertRequiredChromeExtensionKey, () => {
  it("accepts a valid required release key", () => {
    expect(() => {
      assertRequiredChromeExtensionKey(validPrivateKeyPem, true);
    }).not.toThrow();
  });

  it("rejects a missing required release key", () => {
    expect(() => {
      assertRequiredChromeExtensionKey(undefined, true);
    }).toThrow("WXT_CHROME_KEY is required");
  });

  it("rejects a malformed required release key", () => {
    expect(() => {
      assertRequiredChromeExtensionKey("invalid PEM", true);
    }).toThrow("WXT_CHROME_KEY must contain a valid Chrome private key");
  });

  it("preserves optional local build behavior", () => {
    expect(() => {
      assertRequiredChromeExtensionKey("invalid PEM", false);
    }).not.toThrow();
  });
});

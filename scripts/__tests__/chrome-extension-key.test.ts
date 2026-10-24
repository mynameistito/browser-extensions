import { describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";

import { deriveOptionalChromeManifestKey } from "../chrome-extension-key";

const validPrivateKeyPem = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { format: "pem", type: "pkcs8" },
  publicKeyEncoding: { format: "pem", type: "spki" },
}).privateKey;

describe("deriveOptionalChromeManifestKey", () => {
  test("derives the manifest key from a valid PEM", () => {
    expect(deriveOptionalChromeManifestKey(validPrivateKeyPem, true)).toMatch(
      /^[A-Za-z0-9+/]+=*$/u
    );
  });

  test("throws for an invalid required PEM", () => {
    expect(() =>
      deriveOptionalChromeManifestKey("invalid PEM", true)
    ).toThrow();
  });

  test("ignores an invalid optional PEM", () => {
    expect(
      deriveOptionalChromeManifestKey("invalid PEM", false)
    ).toBeUndefined();
  });
});

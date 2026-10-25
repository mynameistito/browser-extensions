import { generateKeyPairSync } from "node:crypto";

import { it, describe, expect } from "vitest";

import { deriveOptionalChromeManifestKey } from "../chrome-extension-key";

const validPrivateKeyPem = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { format: "pem", type: "pkcs8" },
  publicKeyEncoding: { format: "pem", type: "spki" },
}).privateKey;

describe(deriveOptionalChromeManifestKey, () => {
  it("derives the manifest key from a valid PEM", () => {
    expect(deriveOptionalChromeManifestKey(validPrivateKeyPem, true)).toMatch(
      /^[A-Za-z0-9+/]+=*$/u
    );
  });

  it("throws for an invalid required PEM", () => {
    expect(() => deriveOptionalChromeManifestKey("invalid PEM", true)).toThrow(
      /.+/u
    );
  });

  it("ignores an invalid optional PEM", () => {
    expect(
      deriveOptionalChromeManifestKey("invalid PEM", false)
    ).toBeUndefined();
  });
});

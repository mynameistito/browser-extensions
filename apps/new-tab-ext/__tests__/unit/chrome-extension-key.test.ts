import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { deriveChromeExtensionKey } from "../../../../scripts/chrome-extension-key";

describe(deriveChromeExtensionKey, () => {
  it("derives the same manifest key and Chromium ID for the same private key", () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" },
    });

    const first = deriveChromeExtensionKey(privateKey);
    const second = deriveChromeExtensionKey(privateKey);

    expect(first).toStrictEqual(second);
    expect(first.extensionId).toMatch(/^[a-p]{32}$/u);
    expect(Buffer.from(first.manifestKey, "base64").byteLength).toBeGreaterThan(
      0
    );
  });

  it("rejects malformed private key input", () => {
    expect(() => deriveChromeExtensionKey("not a private key")).toThrow(
      "Invalid PEM"
    );
  });
});

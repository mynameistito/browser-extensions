import { createHash, createPublicKey } from "node:crypto";

/** Public Chrome identity information derived from a private PKCS8 PEM key. */
export interface ChromeExtensionKey {
  /** Base64-encoded SubjectPublicKeyInfo value for `manifest.key`. */
  readonly manifestKey: string;
  /** Chromium extension ID derived from the public key. */
  readonly extensionId: string;
}

/** Derive Chromium's public manifest key and extension ID from a private key. */
export const deriveChromeExtensionKey = (
  privateKeyPem: string
): ChromeExtensionKey => {
  const subjectPublicKeyInfo = createPublicKey(privateKeyPem).export({
    format: "der",
    type: "spki",
  });
  const manifestKey = Buffer.from(subjectPublicKeyInfo).toString("base64");
  const digest = createHash("sha256")
    .update(subjectPublicKeyInfo)
    .digest("hex")
    .slice(0, 32);
  const extensionId = [...digest]
    .map((character) =>
      String.fromCodePoint(97 + Number.parseInt(character, 16))
    )
    .join("");

  return { extensionId, manifestKey };
};

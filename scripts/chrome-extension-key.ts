import { createHash, createPublicKey } from "node:crypto";

/** Public Chrome identity information derived from a private PKCS8 PEM key. */
export interface ChromeExtensionKey {
  /** Base64-encoded SubjectPublicKeyInfo value for `manifest.key`. */
  readonly manifestKey: string;
  /** Chromium extension ID derived from the public key. */
  readonly extensionId: string;
}

/**
 * Derive Chromium's public manifest key and extension ID from a private key.
 * @param privateKeyPem - PKCS#8 RSA private key in PEM form.
 * @returns Chromium's base64 manifest key and stable extension ID.
 */
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

  const extensionId = Array.from(digest, (character) =>
    String.fromCodePoint(97 + Number.parseInt(character, 16))
  ).join("");

  return { extensionId, manifestKey };
};

/**
 * Derive a manifest key while allowing malformed local keys only when the key
 * is optional. Release builds can require a valid key and fail closed.
 * @param privateKeyPem - PKCS#8 RSA private key in PEM form.
 * @param required - Whether an invalid key must fail the build.
 * @returns The base64 manifest key, or undefined for an invalid optional key.
 */
export const deriveOptionalChromeManifestKey = (
  privateKeyPem: string,
  required: boolean
): string | undefined => {
  try {
    return deriveChromeExtensionKey(privateKeyPem).manifestKey;
  } catch (error) {
    if (required) {
      throw error;
    }

    return undefined;
  }
};

/**
 * Ensure a required release signing key is present and can be parsed.
 * @param privateKeyPem - PKCS#8 RSA private key in PEM form, when supplied.
 * @param required - Whether the release requires a stable Chrome key.
 */
export const assertRequiredChromeExtensionKey = (
  privateKeyPem: string | undefined,
  required: boolean
): void => {
  if (!required) {
    return;
  }

  if (privateKeyPem === undefined || privateKeyPem.length === 0) {
    throw new Error("WXT_CHROME_KEY is required to release this app.");
  }

  try {
    deriveChromeExtensionKey(privateKeyPem);
  } catch {
    throw new Error("WXT_CHROME_KEY must contain a valid Chrome private key.");
  }
};

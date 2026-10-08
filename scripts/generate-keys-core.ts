import { generateKeyPairSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

import { deriveChromeExtensionKey } from "./chrome-extension-key";

/** Result of writing a persistent Chromium signing key. */
export type GenerateChromeKeyResult =
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "generated"; readonly extensionId: string };

/** Generate a PKCS#8 RSA key at the requested path without accidental rotation. */
export const generateChromeKeyFile = (
  keyPath: string,
  force: boolean
): GenerateChromeKeyResult => {
  if (existsSync(keyPath) && !force) {
    return {
      kind: "error",
      message: "Key already exists; use --force to replace it.",
    };
  }

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
  });

  try {
    writeFileSync(keyPath, privateKey, {
      encoding: "utf-8",
      flag: force ? "w" : "wx",
      mode: 0o600,
    });
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Unable to write the key file.",
    };
  }

  return {
    extensionId: deriveChromeExtensionKey(privateKey).extensionId,
    kind: "generated",
  };
};

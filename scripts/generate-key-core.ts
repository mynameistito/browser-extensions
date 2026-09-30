import { generateKeyPairSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

import { deriveChromeExtensionKey } from "./chrome-extension-key";

export type KeyGenerationResult =
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "generated";
      readonly extensionId: string;
      readonly secretCommand: string;
    };

/** Generate and safely persist the stable private key for Chromium builds. */
export const generateChromeKey = (
  args: readonly string[],
  keyPath: string,
  platform: NodeJS.Platform = process.platform
): KeyGenerationResult => {
  const normalizedArgs = args.filter((argument) => argument !== "--");
  const force = normalizedArgs.some(
    (argument) => argument === "--force" || argument === "-f"
  );
  const unknownArguments = normalizedArgs.filter(
    (argument) => argument !== "--force" && argument !== "-f"
  );

  if (unknownArguments.length > 0) {
    return {
      kind: "error",
      message: `Unknown option: ${unknownArguments.join(", ")}\nUsage: bun run generate-key [--force|-f]`,
    };
  }

  if (existsSync(keyPath) && !force) {
    return {
      kind: "error",
      message:
        "Refusing to replace key.pem. Use --force only if you intend to change the Chrome extension ID.",
    };
  }

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
  });
  const keyInfo = deriveChromeExtensionKey(privateKey);

  writeFileSync(keyPath, privateKey, {
    encoding: "utf-8",
    flag: force ? "w" : "wx",
    mode: 0o600,
  });

  const secretCommand =
    platform === "win32"
      ? "Get-Content key.pem -Raw | gh secret set WXT_CHROME_KEY --repo mynameistito/new-tab-ext"
      : "gh secret set WXT_CHROME_KEY --repo mynameistito/new-tab-ext < key.pem";

  return {
    kind: "generated",
    extensionId: keyInfo.extensionId,
    secretCommand,
  };
};

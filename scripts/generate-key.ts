import { generateKeyPairSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

import { deriveChromeExtensionKey } from "./chrome-extension-key";

const KEY_PATH = path.resolve("key.pem");
const args = process.argv.slice(2).filter((argument) => argument !== "--");
const force = args.some(
  (argument) => argument === "--force" || argument === "-f"
);
const unknownArguments = args.filter(
  (argument) => argument !== "--force" && argument !== "-f"
);

if (unknownArguments.length > 0) {
  console.error(`Unknown option: ${unknownArguments.join(", ")}`);
  console.error("Usage: bun run generate-key [--force|-f]");
  process.exitCode = 1;
} else if (existsSync(KEY_PATH) && !force) {
  console.error(
    "Refusing to replace key.pem. Use --force only if you intend to change the Chrome extension ID."
  );
  process.exitCode = 1;
} else {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
  });
  const keyInfo = deriveChromeExtensionKey(privateKey);

  writeFileSync(KEY_PATH, privateKey, {
    encoding: "utf-8",
    flag: force ? "w" : "wx",
    mode: 0o600,
  });

  const secretCommand =
    process.platform === "win32"
      ? "Get-Content key.pem -Raw | gh secret set WXT_CHROME_KEY --repo mynameistito/new-tab-ext"
      : "gh secret set WXT_CHROME_KEY --repo mynameistito/new-tab-ext < key.pem";

  console.log("Generated the gitignored key.pem private key.");
  console.log(`Chrome extension ID: ${keyInfo.extensionId}`);
  console.log("Register this private key for default-branch CI builds:");
  console.log(secretCommand);
}

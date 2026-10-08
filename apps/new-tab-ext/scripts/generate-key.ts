import path from "node:path";

import { generateChromeKey } from "./generate-key-core";

const result = generateChromeKey(
  process.argv.slice(2),
  path.resolve("key.pem")
);

if (result.kind === "error") {
  console.error(result.message);
  process.exitCode = 1;
} else {
  console.log("Generated the gitignored key.pem private key.");
  console.log(`Chrome extension ID: ${result.extensionId}`);
  console.log("Register this private key for default-branch CI builds:");
  console.log(result.secretCommand);
}

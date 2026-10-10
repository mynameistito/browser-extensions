import { createHash, createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const KEY_PATH = "key.pem";

if (existsSync(KEY_PATH)) {
  console.error(
    `Refusing to overwrite existing ${KEY_PATH}. Delete it first if you really mean to rotate the extension ID.`
  );
  process.exit(1);
}

const proc = Bun.spawnSync({
  cmd: [
    "openssl",
    "genpkey",
    "-algorithm",
    "RSA",
    "-out",
    KEY_PATH,
    "-pkeyopt",
    "rsa_keygen_bits:2048",
  ],
  stderr: "inherit",
  stdout: "inherit",
});

if (proc.exitCode !== 0) {
  console.error("openssl failed. Is it on PATH? (try a new shell)");
  process.exit(proc.exitCode ?? 1);
}

let pem: string;
let spkiPem: string;
try {
  pem = readFileSync(KEY_PATH, "utf-8");
  spkiPem = createPublicKey(pem).export({
    format: "pem",
    type: "spki",
  }) as string;
} catch (error) {
  console.error(
    `Failed to read or parse ${KEY_PATH}:`,
    (error as Error).message
  );
  process.exit(1);
}

const spkiB64 = spkiPem
  .replaceAll("-----BEGIN PUBLIC KEY-----", "")
  .replaceAll("-----END PUBLIC KEY-----", "")
  .replaceAll(/\s+/gu, "");

const spkiDer = Buffer.from(spkiB64, "base64");
const digest = createHash("sha256").update(spkiDer).digest("hex").slice(0, 32);
const extensionId = [...digest]
  .map((c) => String.fromCodePoint(97 + Number.parseInt(c, 16)))
  .join("");

console.log(`\n\u2714 Generated ${KEY_PATH}\n`);
console.log(`Extension ID: ${extensionId}\n`);
console.log("manifest.key (SPKI public, base64):");
console.log(spkiB64);
console.log(
  "\nTo register the key with GitHub Actions (requires gh CLI logged in):\n"
);
console.log(`  gh secret set WXT_CHROME_KEY < ${KEY_PATH}\n`);

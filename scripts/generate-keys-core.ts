import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { deriveChromeExtensionKey } from "./chrome-extension-key";

/** Apps whose release workflows require stable Chromium signing keys. */
export const supportedExtensions = [
  "hide-email-ext",
  "quote-viewer",
  "new-tab-ext",
] as const;

/** An app configured to use a persistent Chromium signing key. */
export type Extension = (typeof supportedExtensions)[number];

/** Parsed options for the key-generation command. */
export interface GenerateKeyOptions {
  /** App keys to create. */
  readonly extensions: readonly Extension[];
  /** Replace existing private keys. */
  readonly force: boolean;
  /** Upload the generated key to GitHub instead of only printing a command. */
  readonly upload: boolean;
  /** GitHub repository override for a single app. */
  readonly repository: string | undefined;
}

/** Result of parsing generator command-line options. */
export type ParseGenerateKeyOptionsResult =
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ok"; readonly options: GenerateKeyOptions };

const usage =
  "Usage: bun run generate-keys [--app <hide-email-ext|quote-viewer|new-tab-ext>] [--repo <owner/name>] [--upload] [--force]";

const isExtension = (value: string): value is Extension =>
  supportedExtensions.some((extension) => extension === value);

/** Parse CLI arguments and reject ambiguous repo/upload targets. */
export const parseGenerateKeyOptions = (
  args: readonly string[]
): ParseGenerateKeyOptionsResult => {
  const selectedExtensions: Extension[] = [];
  let force = false;
  let upload = false;
  let repository: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--force" || argument === "-f") {
      force = true;
      continue;
    }

    if (argument === "--upload") {
      upload = true;
      continue;
    }

    if (argument === "--app") {
      const extension = args[index + 1];
      if (!extension || !isExtension(extension)) {
        return {
          kind: "error",
          message: `Missing or unknown app for --app.\n${usage}`,
        };
      }
      selectedExtensions.push(extension);
      index += 1;
      continue;
    }

    if (argument === "--repo") {
      const value = args[index + 1];
      if (!value || !/^[\w.-]+\/[\w.-]+$/u.test(value)) {
        return {
          kind: "error",
          message: `Missing or invalid repository for --repo. Use owner/name.\n${usage}`,
        };
      }
      repository = value;
      index += 1;
      continue;
    }

    return { kind: "error", message: `Unknown option: ${argument}\n${usage}` };
  }

  const uniqueExtensions = [...new Set(selectedExtensions)];
  if ((repository || upload) && uniqueExtensions.length !== 1) {
    return {
      kind: "error",
      message: `--repo and --upload require exactly one --app target.\n${usage}`,
    };
  }

  return {
    kind: "ok",
    options: {
      extensions:
        uniqueExtensions.length > 0 ? uniqueExtensions : supportedExtensions,
      force,
      repository,
      upload,
    },
  };
};

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

/** Send a PEM key to the release workflow's WXT_CHROME_KEY Actions secret. */
export const uploadChromeKey = (
  keyPath: string,
  repository: string
):
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "uploaded" } => {
  try {
    const keyPem = readFileSync(keyPath, "utf-8");
    const result = spawnSync(
      "gh",
      ["secret", "set", "WXT_CHROME_KEY", "--repo", repository],
      {
        encoding: "utf-8",
        input: keyPem,
        stdio: ["pipe", "inherit", "inherit"],
      }
    );

    if (result.error) {
      return {
        kind: "error",
        message: `Unable to run gh: ${result.error.message}`,
      };
    }
    if (result.status !== 0) {
      return {
        kind: "error",
        message: `gh secret set failed with exit code ${String(result.status)}.`,
      };
    }

    return { kind: "uploaded" };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error ? error.message : "Unable to upload the key.",
    };
  }
};

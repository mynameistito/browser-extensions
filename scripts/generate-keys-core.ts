import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";

import { deriveChromeExtensionKey } from "./chrome-extension-key";

/** Apps whose release workflows require stable Chromium signing keys. */
export const supportedExtensions = [
  "hide-email-ext",
  "quote-viewer",
  "new-tab-ext",
] as const;

/** An app configured to use a persistent Chromium signing key. */
export type Extension = (typeof supportedExtensions)[number];

/** Per-app GitHub Actions secrets referenced by the workflows. */
export const chromeKeySecrets = {
  "hide-email-ext": "HIDE_EMAIL_WXT_CHROME_KEY",
  "new-tab-ext": "NEW_TAB_WXT_CHROME_KEY",
  "quote-viewer": "QUOTE_VIEWER_WXT_CHROME_KEY",
} as const satisfies Record<Extension, string>;

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
  | { readonly kind: "help"; readonly message: string }
  | { readonly kind: "ok"; readonly options: GenerateKeyOptions };

const usage =
  "Usage: bun run generate-keys [--app <hide-email-ext|quote-viewer|new-tab-ext>] [--repo <owner/name>] [--upload] [--force]";

/** Complete help text for the root key-generation command. */
export const generateKeyHelp = `${usage}

Generate RSA signing keys for the Chromium extensions. Without --app, keys are
generated for all supported apps. Each app's private key is written to its own
gitignored apps/<app>/key.pem file.

Options:
  --app <name>         Generate a key for one app.
  --repo <owner/name>  Override the GitHub repository for the secret command.
  --upload             Upload the key to GitHub with gh instead of printing a command.
  --force, -f          Replace an existing key and change that extension's ID.
  --help, -h           Show this help message.

The repository defaults to mynameistito/browser-extensions. --repo and --upload
require exactly one --app. Keys are stored in the per-app Actions secrets used
by the workflows; uploads require gh to be installed and authenticated.

Examples:
  bun run generate-keys
  bun run generate-keys -- --app quote-viewer
  bun run generate-keys -- --app quote-viewer --repo owner/name
  bun run generate-keys -- --app quote-viewer --upload
`;

interface GhCommandResult {
  readonly error: Error | undefined;
  readonly status: number | null;
}

type GhSecretCommand = (
  args: readonly string[],
  input: string
) => GhCommandResult;

const isExtension = (value: string): value is Extension =>
  supportedExtensions.some((extension) => extension === value);

const runGhSecretCommand: GhSecretCommand = (args, input) => {
  const result = spawnSync("gh", args, {
    encoding: "utf-8",
    input,
    stdio: ["pipe", "inherit", "inherit"],
  });

  return { error: result.error, status: result.status };
};

/** Parse CLI arguments and reject ambiguous repo/upload targets. */
export const parseGenerateKeyOptions = (
  args: readonly string[]
): ParseGenerateKeyOptionsResult => {
  if (args.some((argument) => argument === "--help" || argument === "-h")) {
    return { kind: "help", message: generateKeyHelp };
  }

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
    chmodSync(keyPath, 0o600);
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

/** Upload a PEM key to the release workflow's per-app GitHub Actions secret. */
export const uploadChromeKey = (
  keyPath: string,
  repository: string,
  secretName: string,
  runCommand: GhSecretCommand = runGhSecretCommand
):
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "uploaded" } => {
  try {
    const keyPem = readFileSync(keyPath, "utf-8");
    const result = runCommand(
      ["secret", "set", secretName, "--repo", repository],
      keyPem
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

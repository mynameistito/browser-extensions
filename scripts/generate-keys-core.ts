import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import {
  chmodSync,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { deriveChromeExtensionKey } from "./chrome-extension-key";

/** Apps whose release workflows require stable Chromium signing keys. */
export const supportedExtensions = [
  "better-history",
  "hide-email-ext",
  "quote-viewer",
  "new-tab-ext",
  "ig-video-controls",
  "github-settings-repo-copy",
  "hide-ip-ext",
  "mute-tab-manager",
] as const;

/** An app configured to use a persistent Chromium signing key. */
export type Extension = (typeof supportedExtensions)[number];

/** Per-app GitHub Actions secrets referenced by the workflows. */
export const chromeKeySecrets = {
  "better-history": "BETTER_HISTORY_WXT_CHROME_KEY",
  "github-settings-repo-copy": "WXT_GITHUB_SETTINGS_REPO_COPY_CHROME_KEY",
  "hide-email-ext": "HIDE_EMAIL_WXT_CHROME_KEY",
  "hide-ip-ext": "HIDE_IP_WXT_CHROME_KEY",
  "ig-video-controls": "IG_VIDEO_CONTROLS_WXT_CHROME_KEY",
  "mute-tab-manager": "MUTE_TAB_MANAGER_WXT_CHROME_KEY",
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
  "Usage: bun generate-keys [--app <all|better-history|hide-email-ext|hide-ip-ext|quote-viewer|new-tab-ext|ig-video-controls|github-settings-repo-copy|mute-tab-manager>] [--repo <owner/name>] [--upload] [--force]";

/** Complete help text for the root key-generation command. */
export const generateKeyHelp = `${usage}

Generate RSA signing keys for the Chromium extensions. Without --app, keys are
generated for all supported apps. Each app's private key is written to its own
gitignored apps/<app>/key.pem file.

Options:
  --app <name|all>     Generate keys for one app or all supported apps.
  --repo <owner/name>  Override the GitHub repository for secret uploads (one app only).
  --upload             Upload generated keys to GitHub with gh instead of printing commands.
  --force, -f          Replace an existing key and change that extension's ID.
  --help, -h           Show this help message.

The repository defaults to mynameistito/browser-extensions. --upload requires
an explicit --app target; use --app all to upload every key. --repo requires
exactly one app. Keys are stored in the per-app Actions secrets used by the
workflows; uploads require gh to be installed and authenticated.

Examples:
  bun generate-keys
  bun generate-keys --app quote-viewer
  bun generate-keys --app quote-viewer --repo owner/name
  bun generate-keys --app quote-viewer --upload
  bun generate-keys --app all --upload
`;

interface GhCommandResult {
  readonly error: Error | null;
  readonly status: number | null;
}

type GhSecretCommand = (
  args: readonly string[],
  input: string
) => GhCommandResult;

const isExtension = (value: string): value is Extension =>
  supportedExtensions.some((extension) => extension === value);

const parseAppTarget = (
  value: string | undefined
): readonly Extension[] | null => {
  if (value === "all") {
    return supportedExtensions;
  }

  return value !== undefined && isExtension(value) ? [value] : null;
};

const isRepository = (value: string | undefined): value is string =>
  value !== undefined && /^[\w.-]+\/[\w.-]+$/u.test(value);

/**
 * Find GitHub CLI at a configured or standard installation path.
 * @returns An absolute executable path, or null when GitHub CLI is unavailable.
 */
const findGhExecutable = (): string | null => {
  const configuredPath = process.env.GH_CLI_PATH;

  if (
    configuredPath !== undefined &&
    path.isAbsolute(configuredPath) &&
    existsSync(configuredPath) &&
    statSync(configuredPath).isFile()
  ) {
    return configuredPath;
  }

  const candidates: string[] = [];

  if (process.platform === "win32") {
    candidates.push(
      path.join(
        process.env.ProgramFiles ?? "C:\\Program Files",
        "GitHub CLI",
        "gh.exe"
      )
    );

    if (process.env.LOCALAPPDATA !== undefined) {
      candidates.push(
        path.join(process.env.LOCALAPPDATA, "Programs", "GitHub CLI", "gh.exe")
      );
    }
  } else if (process.platform === "darwin") {
    candidates.push("/opt/homebrew/bin/gh", "/usr/local/bin/gh");
  } else {
    candidates.push("/usr/bin/gh", "/usr/local/bin/gh");
  }

  return (
    candidates.find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile()
    ) ?? null
  );
};

const runGhSecretCommand: GhSecretCommand = (args, input) => {
  const executable = findGhExecutable();

  if (executable === null) {
    return {
      error: new Error(
        "GitHub CLI was not found. Set GH_CLI_PATH to its absolute executable path."
      ),
      status: null,
    };
  }

  const result = spawnSync(executable, args, {
    encoding: "utf-8",
    input,
    stdio: ["pipe", "inherit", "inherit"],
  });

  return { error: result.error ?? null, status: result.status };
};

/**
 * Parse CLI arguments and reject ambiguous repo/upload targets.
 * @param args - The command-line arguments after the executable name.
 * @returns The parsed options, help request, or validation error.
 */
export const parseGenerateKeyOptions = (
  args: readonly string[]
): ParseGenerateKeyOptionsResult => {
  if (args.some((argument) => argument === "--help" || argument === "-h")) {
    return { kind: "help", message: generateKeyHelp };
  }

  const selectedExtensions: Extension[] = [];
  let force = false;
  let hasAppSelection = false;
  let upload = false;
  let repository: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--force" || argument === "-f") {
      force = true;
    } else if (argument === "--upload") {
      upload = true;
    } else if (argument === "--app") {
      const appTarget = parseAppTarget(args[index + 1]);

      if (appTarget === null) {
        return {
          kind: "error",
          message: `Missing or unknown app for --app. Choose a supported app or all.\n${usage}`,
        };
      }

      selectedExtensions.push(...appTarget);
      hasAppSelection = true;
      index += 1;
    } else if (argument === "--repo") {
      const value = args[index + 1];

      if (!isRepository(value)) {
        return {
          kind: "error",
          message: `Missing or invalid repository for --repo. Use owner/name.\n${usage}`,
        };
      }

      repository = value;
      index += 1;
    } else {
      return {
        kind: "error",
        message: `Unknown option: ${argument}\n${usage}`,
      };
    }
  }

  const uniqueExtensions = [...new Set(selectedExtensions)];

  if (repository !== undefined && uniqueExtensions.length !== 1) {
    return {
      kind: "error",
      message: `--repo requires exactly one --app target.\n${usage}`,
    };
  }

  if (upload && !hasAppSelection) {
    return {
      kind: "error",
      message: `--upload requires an explicit --app target; use --app all to upload every key.\n${usage}`,
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

/**
 * Generate a PKCS#8 RSA key at the requested path without accidental rotation.
 * @param keyPath - Destination for the generated PEM key.
 * @param force - Whether to replace an existing key.
 * @returns The generated extension ID or a write error.
 */
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

/**
 * Upload a PEM key to the release workflow's per-app GitHub Actions secret.
 * @param keyPath - Path to the PEM key to upload.
 * @param repository - GitHub repository in owner/name form.
 * @param secretName - Actions secret name receiving the key.
 * @param runCommand - Function that sends the secret to GitHub.
 * @returns Whether the upload succeeded or an error explaining the failure.
 */
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

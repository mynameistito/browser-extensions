import { existsSync } from "node:fs";
import path from "node:path";

import { generateChromeKeyFile } from "./generate-keys-core";

const extensions = ["hide-email-ext", "quote-viewer", "new-tab-ext"] as const;
type Extension = (typeof extensions)[number];
const isExtension = (value: string): value is Extension =>
  extensions.some((extension) => extension === value);

interface Options {
  readonly extensions: readonly Extension[];
  readonly force: boolean;
}

type ParseOptionsResult =
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ok"; readonly options: Options };

const usage =
  "Usage: bun run generate-keys [--app <hide-email-ext|quote-viewer|new-tab-ext>] [--force]";

const parseOptions = (args: readonly string[]): ParseOptionsResult => {
  const selectedExtensions: Extension[] = [];
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--force" || argument === "-f") {
      force = true;
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

    return { kind: "error", message: `Unknown option: ${argument}\n${usage}` };
  }

  const uniqueExtensions = [...new Set(selectedExtensions)];
  return {
    kind: "ok",
    options: {
      extensions: uniqueExtensions.length > 0 ? uniqueExtensions : extensions,
      force,
    },
  };
};

const generateKey = (
  extension: Extension,
  force: boolean
):
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "generated"; readonly output: string } => {
  const keyPath = path.resolve(
    import.meta.dirname,
    "..",
    "apps",
    extension,
    "key.pem"
  );
  const result = generateChromeKeyFile(keyPath, force);
  if (result.kind === "error") {
    return { kind: "error", message: `${extension}: ${result.message}` };
  }
  const repository = `mynameistito/${extension}`;
  const secretCommand =
    process.platform === "win32"
      ? `Get-Content apps/${extension}/key.pem -Raw | gh secret set WXT_CHROME_KEY --repo ${repository}`
      : `gh secret set WXT_CHROME_KEY --repo ${repository} < apps/${extension}/key.pem`;

  return {
    kind: "generated",
    output: `Generated apps/${extension}/key.pem\nChrome extension ID: ${result.extensionId}\nSet the GitHub Actions secret with:\n${secretCommand}`,
  };
};

const parsed = parseOptions(process.argv.slice(2));
if (parsed.kind === "error") {
  console.error(parsed.message);
  process.exitCode = 1;
} else {
  const existing = parsed.options.extensions.filter((extension) =>
    existsSync(
      path.resolve(import.meta.dirname, "..", "apps", extension, "key.pem")
    )
  );

  if (existing.length > 0 && !parsed.options.force) {
    console.error(
      `Refusing to replace existing keys for: ${existing.join(", ")}. Use --force only if you intend to change those extension IDs.`
    );
    process.exitCode = 1;
  } else {
    for (const extension of parsed.options.extensions) {
      const result = generateKey(extension, parsed.options.force);
      if (result.kind === "error") {
        console.error(result.message);
        process.exitCode = 1;
      } else {
        console.log(result.output);
      }
    }
  }
}

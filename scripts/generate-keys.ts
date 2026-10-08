import { existsSync } from "node:fs";
import path from "node:path";

import type { Extension } from "./generate-keys-core";
import {
  chromeKeySecrets,
  parseGenerateKeyOptions,
  generateChromeKeyFile,
  uploadChromeKey,
} from "./generate-keys-core";

const defaultRepository = "mynameistito/browser-extensions";

const generateKey = (
  extension: Extension,
  options: {
    readonly force: boolean;
    readonly repository: string | undefined;
    readonly upload: boolean;
  }
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
  const result = generateChromeKeyFile(keyPath, options.force);
  if (result.kind === "error") {
    return { kind: "error", message: `${extension}: ${result.message}` };
  }
  const repository = options.repository ?? defaultRepository;
  const secretName = chromeKeySecrets[extension];
  if (options.upload) {
    const uploadResult = uploadChromeKey(keyPath, repository, secretName);
    if (uploadResult.kind === "error") {
      return {
        kind: "error",
        message: `${extension}: key generated, but upload failed: ${uploadResult.message}`,
      };
    }

    return {
      kind: "generated",
      output: `Generated apps/${extension}/key.pem\nChrome extension ID: ${result.extensionId}\nUploaded as ${secretName} to ${repository}.`,
    };
  }

  const secretCommand =
    process.platform === "win32"
      ? `Get-Content apps/${extension}/key.pem -Raw | gh secret set ${secretName} --repo ${repository}`
      : `gh secret set ${secretName} --repo ${repository} < apps/${extension}/key.pem`;

  return {
    kind: "generated",
    output: `Generated apps/${extension}/key.pem\nChrome extension ID: ${result.extensionId}\nSet the GitHub Actions secret with:\n${secretCommand}`,
  };
};

const parsed = parseGenerateKeyOptions(process.argv.slice(2));
if (parsed.kind === "help") {
  console.log(parsed.message);
} else if (parsed.kind === "error") {
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
      const result = generateKey(extension, parsed.options);
      if (result.kind === "error") {
        console.error(result.message);
        process.exitCode = 1;
      } else {
        console.log(result.output);
      }
    }
  }
}

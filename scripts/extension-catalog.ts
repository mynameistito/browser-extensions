import { readFileSync } from "node:fs";
import path from "node:path";

export interface ExtensionApp {
  readonly name: string;
  readonly directory: string;
  readonly scripts: Readonly<Record<string, string>>;
  readonly chromeSigningSecret: string | undefined;
}

interface PackageManifest {
  readonly name?: unknown;
  readonly scripts?: unknown;
  readonly browserExtension?: unknown;
}

const secretNamePattern = /^[A-Z_][A-Z0-9_]*$/u;
const repositoryRoot = path.resolve(import.meta.dirname, "..");

const readManifest = (manifestPath: string): PackageManifest => {
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf-8"));
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest)
  ) {
    throw new Error(`Invalid package manifest: ${manifestPath}`);
  }
  return manifest as PackageManifest;
};

/** Validate a package manifest and return its extension identity and capabilities. */
export const parseExtensionManifest = (
  manifestPath: string,
  directory: string
): ExtensionApp => {
  const manifest = readManifest(manifestPath);
  const appDirectory = path.basename(directory);
  if (typeof manifest.name !== "string" || manifest.name.trim() === "") {
    throw new Error(
      `Extension manifest in ${appDirectory} must have a nonempty name.`
    );
  }
  if (manifest.name !== appDirectory) {
    throw new Error(
      `Extension package name ${manifest.name} does not match app directory ${appDirectory}.`
    );
  }

  const scripts = manifest.scripts ?? {};
  if (
    typeof scripts !== "object" ||
    scripts === null ||
    Array.isArray(scripts)
  ) {
    throw new Error(
      `Scripts in ${manifest.name}/package.json must be an object.`
    );
  }

  let chromeSigningSecret: string | undefined;
  if (manifest.browserExtension !== undefined) {
    if (
      typeof manifest.browserExtension !== "object" ||
      manifest.browserExtension === null ||
      Array.isArray(manifest.browserExtension)
    ) {
      throw new Error(
        `browserExtension in ${manifest.name}/package.json must be an object.`
      );
    }
    const { chromeSigningSecret: secret } = manifest.browserExtension as Record<
      string,
      unknown
    >;
    if (secret !== undefined) {
      if (typeof secret !== "string" || !secretNamePattern.test(secret)) {
        throw new Error(
          `Invalid Chrome signing Actions secret in ${manifest.name}/package.json.`
        );
      }
      chromeSigningSecret = secret;
    }
  }

  return {
    chromeSigningSecret,
    directory: appDirectory,
    name: manifest.name,
    scripts: scripts as Readonly<Record<string, string>>,
  };
};

export const validateExtensionApps = (
  apps: readonly ExtensionApp[]
): readonly ExtensionApp[] => {
  const names = new Set<string>();
  const secrets = new Set<string>();
  for (const app of apps) {
    if (names.has(app.name)) {
      throw new Error(`Duplicate extension package name: ${app.name}.`);
    }
    names.add(app.name);
    if (app.chromeSigningSecret) {
      if (secrets.has(app.chromeSigningSecret)) {
        throw new Error(
          `Duplicate Chrome signing Actions secret: ${app.chromeSigningSecret}.`
        );
      }
      secrets.add(app.chromeSigningSecret);
    }
  }
  return apps;
};

/** Discover extension apps from package manifests under apps in deterministic order. */
export const discoverExtensionCatalog = (
  root = repositoryRoot
): readonly ExtensionApp[] => {
  const glob = new Bun.Glob("apps/*/package.json");
  const appPaths = [
    ...glob.scanSync({ cwd: root, onlyFiles: true }),
  ].toSorted();
  const apps = appPaths.map((manifestPath) => {
    const absolutePath = path.join(root, manifestPath);
    return parseExtensionManifest(absolutePath, path.dirname(absolutePath));
  });

  return validateExtensionApps(apps);
};

export const extensionCatalog = discoverExtensionCatalog();
export const persistentChromeKeyApps = extensionCatalog.filter(
  (app) => app.chromeSigningSecret !== undefined
);

if (import.meta.main) {
  const [argument] = process.argv.slice(2);
  if (argument === "--matrix") {
    console.log(
      JSON.stringify({
        include: extensionCatalog
          .filter((app) => app.scripts["ci:release"] !== undefined)
          .map(({ name, chromeSigningSecret }) => ({
            app: name,
            ...(chromeSigningSecret === undefined
              ? {}
              : { chromeSigningSecret }),
          })),
      })
    );
  } else if (argument === "--json") {
    console.log(JSON.stringify(extensionCatalog));
  } else {
    console.error("Usage: bun scripts/extension-catalog.ts [--json|--matrix]");
    process.exitCode = 1;
  }
}

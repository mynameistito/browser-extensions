import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type AppScript = "check" | "typecheck" | "test" | "zip:all";

type AppScripts = Partial<Record<AppScript, string>>;

type JsonValue =
  | boolean
  | null
  | number
  | string
  | readonly JsonValue[]
  | JsonObject;

interface JsonObject {
  readonly [key: string]: JsonValue;
}

interface AppPackage {
  readonly name: string;
  readonly version: string;
  readonly scripts?: AppScripts;
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isAppScripts = (value: unknown): value is AppScripts => {
  if (!isObject(value)) {
    return false;
  }

  const scriptNames: readonly AppScript[] = [
    "check",
    "typecheck",
    "test",
    "zip:all",
  ];

  return scriptNames.every((script) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, script);

    return descriptor === undefined || isString(descriptor.value);
  });
};

const isAppPackage = (value: unknown): value is AppPackage => {
  if (!isObject(value)) {
    return false;
  }

  if (!isString(value.name) || !isString(value.version)) {
    return false;
  }

  return value.scripts === undefined || isAppScripts(value.scripts);
};

const parseAppPackage = (json: string): AppPackage => {
  const value: unknown = JSON.parse(json);

  if (!isAppPackage(value)) {
    throw new TypeError("Invalid app package manifest.");
  }

  return value;
};

const appDir = process.cwd();

const pkg = parseAppPackage(
  readFileSync(path.join(appDir, "package.json"), "utf-8")
);

const tag = `${pkg.name}-v${pkg.version}`;

const expectedAssets = [
  `${pkg.name}-${pkg.version}-chrome.zip`,
  `${pkg.name}-${pkg.version}-firefox.zip`,
];

const run = (command: string, args: string[]): string =>
  execFileSync(command, args, {
    cwd: appDir,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const runInherited = (command: string, args: string[]): void => {
  execFileSync(command, args, { cwd: appDir, stdio: "inherit" });
};

let previousPackage: AppPackage;

try {
  const previousPackageJson = run("git", [
    "show",
    `HEAD^:apps/${pkg.name}/package.json`,
  ]);

  previousPackage = parseAppPackage(previousPackageJson);
} catch {
  console.log(
    `Skipping ${pkg.name}: it had no package manifest in the previous commit.`
  );
  process.exit(0);
}

if (previousPackage.version === pkg.version) {
  console.log(
    `Skipping ${pkg.name}: version ${pkg.version} did not change in this commit.`
  );
  process.exit(0);
}

const readReleaseAssetNames = (): readonly string[] => {
  const output = run("gh", [
    "release",
    "view",
    tag,
    "--repo",
    "mynameistito/browser-extensions",
    "--json",
    "assets",
    "--jq",
    ".assets[].name",
  ]);

  return output ? output.split("\n") : [];
};

try {
  const assets = readReleaseAssetNames();

  if (expectedAssets.every((asset) => assets.includes(asset))) {
    console.log(`Release ${tag} already contains both browser artifacts.`);
    process.exit(0);
  }
} catch {
  // A missing release is created below; other gh errors will surface on create.
}

if (
  process.env.REQUIRE_CHROME_KEY !== undefined &&
  process.env.REQUIRE_CHROME_KEY.length > 0 &&
  (process.env.WXT_CHROME_KEY === undefined ||
    process.env.WXT_CHROME_KEY.length === 0)
) {
  throw new Error(`WXT_CHROME_KEY is required to release ${pkg.name}.`);
}

const scriptsToRun = ["check", "typecheck", "test", "zip:all"] as const;

const scripts = scriptsToRun.filter((script) => {
  const scriptCommand = pkg.scripts?.[script];

  return scriptCommand !== undefined && scriptCommand.length > 0;
});

for (const script of scripts) {
  runInherited("bun", ["run", script]);
}

const releaseAssets = expectedAssets.map((asset) =>
  path.join(appDir, ".output", asset)
);

for (const assetPath of releaseAssets) {
  if (!existsSync(assetPath)) {
    throw new Error(`Expected release artifact was not produced: ${assetPath}`);
  }
}

const changelogPath = path.join(appDir, "CHANGELOG.md");

const changelog = existsSync(changelogPath)
  ? readFileSync(changelogPath, "utf-8")
  : `Release ${pkg.version}`;

const escapedVersion = pkg.version.replaceAll(".", "\\.");

const notesMatch = new RegExp(
  `## ${escapedVersion}\\n([\\s\\S]*?)(?=\\n## |$)`,
  "u"
).exec(changelog);

const releaseNotes = notesMatch?.[1]?.trim();

const notes =
  releaseNotes !== undefined && releaseNotes.length > 0
    ? releaseNotes
    : `Release ${pkg.version}`;

const notesPath = path.join(appDir, ".output", "release-notes.md");

writeFileSync(notesPath, notes, "utf-8");

const target = run("git", ["rev-parse", "HEAD"]);

runInherited("gh", [
  "release",
  "create",
  tag,
  ...releaseAssets,
  "--repo",
  "mynameistito/browser-extensions",
  "--title",
  tag,
  "--notes-file",
  notesPath,
  "--target",
  target,
]);

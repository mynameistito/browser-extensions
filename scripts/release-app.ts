import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface AppPackage {
  readonly name: string;
  readonly version: string;
  readonly scripts?: Readonly<Record<string, string>>;
}

const appDir = process.cwd();
const pkg = JSON.parse(
  readFileSync(path.join(appDir, "package.json"), "utf-8")
) as AppPackage;
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
  previousPackage = JSON.parse(previousPackageJson) as AppPackage;
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

if (process.env.REQUIRE_CHROME_KEY && !process.env.WXT_CHROME_KEY) {
  throw new Error(`WXT_CHROME_KEY is required to release ${pkg.name}.`);
}

const scripts = ["check", "typecheck", "test", "zip:all"].filter(
  (script) => pkg.scripts?.[script]
);
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
const notesMatch = changelog.match(
  new RegExp(`## ${escapedVersion}\\n([\\s\\S]*?)(?=\\n## |$)`, "u")
);
const notes = notesMatch?.[1]?.trim() || `Release ${pkg.version}`;
const notesPath = path.join(appDir, ".output", "release-notes.md");
await Bun.write(notesPath, notes);
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

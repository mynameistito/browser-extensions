import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

const EXPECTED_ASSETS = (ver: string) => [
  `ig-video-controls-${ver}-chrome.zip`,
  `ig-video-controls-${ver}-firefox.zip`,
];

const fetchReleaseAssetNames = (releaseTag: string): string[] => {
  const raw = execSync(
    `gh release view ${releaseTag} --json assets --jq ".assets[].name"`,
    { cwd: ROOT, encoding: "utf-8" }
  ).trim();
  return raw ? raw.split("\n") : [];
};

const verifyReleaseAssets = (releaseTag: string, ver: string): boolean => {
  try {
    const names = fetchReleaseAssetNames(releaseTag);
    return EXPECTED_ASSETS(ver).every((e) => names.includes(e));
  } catch {
    return false;
  }
};

const run = (cmd: string) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
};

const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
if (typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+/u.test(pkg.version)) {
  console.error("package.json version is missing or invalid:", pkg.version);
  process.exit(1);
}
const version = pkg.version as string;
const tag = `v${version}`;

if (verifyReleaseAssets(tag, version)) {
  console.log(
    `Release ${tag} already exists with all expected assets — nothing to do. Exiting.`
  );
  process.exit(0);
}

const keyPath = resolve(ROOT, "key.pem");
if (process.env.REQUIRE_CHROME_KEY && !existsSync(keyPath)) {
  if (!process.env.WXT_CHROME_KEY) {
    console.error(
      "WXT_CHROME_KEY secret is missing — cannot publish without a stable extension ID"
    );
    process.exit(1);
  }
  writeFileSync(keyPath, process.env.WXT_CHROME_KEY);
}

run("bunx wxt prepare");
run("bun run zip");
run("bun run zip:firefox");

const chromeZip = resolve(
  ROOT,
  `.output/ig-video-controls-${version}-chrome.zip`
);
const firefoxZip = resolve(
  ROOT,
  `.output/ig-video-controls-${version}-firefox.zip`
);

if (!existsSync(chromeZip)) {
  console.error(`Chrome zip not found at ${chromeZip}`);
  process.exit(1);
}
if (!existsSync(firefoxZip)) {
  console.error(`Firefox zip not found at ${firefoxZip}`);
  process.exit(1);
}

try {
  execSync(`git rev-parse ${tag}`, { cwd: ROOT, stdio: "pipe" });
} catch {
  execSync(`git tag ${tag}`, { cwd: ROOT });
}

const remoteTag = execSync(`git ls-remote --tags origin refs/tags/${tag}`, {
  cwd: ROOT,
  encoding: "utf-8",
}).trim();

if (!remoteTag) {
  execSync(`git push origin ${tag}`, { cwd: ROOT });
}

let body = `Release ${tag}`;
const changelogPath = resolve(ROOT, "CHANGELOG.md");
if (existsSync(changelogPath)) {
  const changelog = readFileSync(changelogPath, "utf-8");
  const sectionRegex = new RegExp(
    `## ${version.replaceAll(".", "\\.")}\\n([\\s\\S]*?)(?=\\n## |$)`,
    "u"
  );
  const match = changelog.match(sectionRegex);
  if (match?.[1]?.trim()) {
    body = match[1].trim();
  }
}

const notesPath = resolve(ROOT, ".changeset", "RELEASE_NOTES.md");
writeFileSync(notesPath, body);

try {
  execSync(
    `gh release create ${tag} --title "${tag}" --notes-file "${notesPath}" "${chromeZip}" "${firefoxZip}"`,
    { cwd: ROOT, stdio: "inherit" }
  );
} catch (error) {
  let foundTag = "";
  try {
    foundTag = execSync(
      `gh release view ${tag} --json tagName --jq ".tagName"`,
      {
        cwd: ROOT,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }
    ).trim();
  } catch {
    // release doesn't exist — fall through to rethrow
  }

  if (foundTag === tag) {
    console.warn(`Release ${tag} already exists — verifying assets.`);
    const present = fetchReleaseAssetNames(tag);
    const missing = EXPECTED_ASSETS(version).filter(
      (e) => !present.includes(e)
    );
    if (missing.length > 0) {
      console.error(`Release ${tag} is missing assets: ${missing.join(", ")}`);
      process.exit(1);
    }
    console.log(`Release ${tag} has all expected assets — OK.`);
  } else {
    throw error;
  }
}

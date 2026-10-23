import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const PROJECT_ROOT = path.resolve(ROOT, "../..");
const CHANGELOG_PATH = path.resolve(ROOT, "CHANGELOG.md");

const gitConfig = readFileSync(
  path.resolve(PROJECT_ROOT, ".git", "config"),
  "utf-8"
);

let readingOrigin = false;
let repoUrl: string | undefined;

for (const line of gitConfig.split(/\r?\n/u)) {
  const configLine = line.trim();

  if (configLine.startsWith('[remote "') && configLine.endsWith('"]')) {
    readingOrigin = configLine === '[remote "origin"]';
  } else if (readingOrigin && configLine.startsWith("url = ")) {
    repoUrl = configLine.slice("url = ".length).trim();

    if (repoUrl.length > 0) {
      break;
    }
  }
}

const normalizedRemoteUrl =
  repoUrl?.startsWith("git@github.com:") === true
    ? `https://github.com/${repoUrl.slice("git@github.com:".length)}`
    : repoUrl;

const parsedRemote =
  normalizedRemoteUrl === undefined ? null : new URL(normalizedRemoteUrl);

const remoteSegments = parsedRemote?.pathname
  .split("/")
  .filter((segment) => segment.length > 0);

const owner = remoteSegments?.[0];

const repositoryName = remoteSegments?.[1]?.replace(/\.git$/u, "");

const repo =
  parsedRemote?.hostname === "github.com" &&
  owner !== undefined &&
  repositoryName !== undefined
    ? `${owner}/${repositoryName}`
    : undefined;

if (repo === undefined || repo.length === 0) {
  console.error(`Cannot extract owner/repo from remote: ${repoUrl}`);
  process.exit(1);
}

const commitUrlBase = `https://github.com/${repo}/commit`;

let content = readFileSync(CHANGELOG_PATH, "utf-8");

content = content.replaceAll(
  /^(?<prefix>- )(?<commit>[0-9a-f]{7})(?<suffix>: )/gmu,
  (_match, prefix: string, commit: string, suffix: string) =>
    `${prefix}[\`${commit}\`](${commitUrlBase}/${commit})${suffix}`
);

writeFileSync(CHANGELOG_PATH, content);

console.log("CHANGELOG.md: commit hashes hyperlinked.");

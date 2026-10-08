import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const CHANGELOG_PATH = path.resolve(ROOT, "CHANGELOG.md");

const repoUrl = execSync("git remote get-url origin", {
  cwd: ROOT,
  encoding: "utf-8",
}).trim();

const repo = repoUrl.match(/github\.com[:/](?<repo>[^/]+\/[^/]+?)(?:\.git)?$/u)
  ?.groups?.repo;

if (!repo) {
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

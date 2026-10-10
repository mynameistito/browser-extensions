import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const CHANGELOG_PATH = resolve(ROOT, "CHANGELOG.md");

const repoUrl = execSync("git remote get-url origin", {
  cwd: ROOT,
  encoding: "utf-8",
}).trim();

const [, repo] =
  repoUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/u) ?? [];

if (!repo) {
  console.error(`Cannot extract owner/repo from remote: ${repoUrl}`);
  process.exit(1);
}

const commitUrlBase = `https://github.com/${repo}/commit`;

let content = readFileSync(CHANGELOG_PATH, "utf-8");

content = content.replaceAll(
  /^(- )([0-9a-f]{7,40})(: )/gmu,
  `$1[\`$2\`](${commitUrlBase}/$2)$3`
);

writeFileSync(CHANGELOG_PATH, content);
console.log("CHANGELOG.md: commit hashes hyperlinked.");

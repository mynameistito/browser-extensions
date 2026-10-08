import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const appNames = [
  "hide-email-ext",
  "quote-viewer",
  "new-tab-ext",
  "hide-ip-ext",
] as const;
const changeTypes = ["patch", "minor", "major"] as const;

const [appName, changeType, ...summaryParts] = process.argv.slice(2);
const summary = summaryParts.join(" ").trim();

if (!appNames.some((name) => name === appName)) {
  console.error(`App must be one of: ${appNames.join(", ")}`);
  process.exit(1);
}

if (!changeTypes.some((type) => type === changeType)) {
  console.error("Change type must be patch, minor, or major.");
  process.exit(1);
}

if (!summary) {
  console.error(
    'Usage: bun run changeset-add <app> <patch|minor|major> "summary"'
  );
  process.exit(1);
}

const changesetDir = path.join(import.meta.dirname, "..", ".changeset");
mkdirSync(changesetDir, { recursive: true });

let filename: string;
do {
  filename = path.join(changesetDir, `${randomBytes(4).toString("hex")}.md`);
} while (existsSync(filename));

writeFileSync(
  filename,
  `---\n"${appName}": ${changeType}\n---\n\n${summary}\n`
);
console.log(`Created changeset for ${appName}: ${path.basename(filename)}`);

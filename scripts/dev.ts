import { spawnSync } from "node:child_process";
import path from "node:path";

import { isCancel, select } from "@clack/prompts";

const apps = [
  "better-history",
  "github-settings-repo-copy",
  "hide-email-ext",
  "hide-ip-ext",
  "ig-video-controls",
  "mute-tab-manager",
  "new-tab-ext",
  "quote-viewer",
] as const;

const selectedApp = await select({
  message: "Which extension would you like to run dev on?",
  options: apps.map((app) => ({ label: app, value: app })),
});

if (isCancel(selectedApp)) {
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ["run", "dev", ...process.argv.slice(2)],
  {
    cwd: path.resolve(import.meta.dirname, "..", "apps", selectedApp),
    stdio: "inherit",
  }
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;

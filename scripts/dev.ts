import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

import { isCancel, select } from "@clack/prompts";

const appsDirectory = path.resolve(import.meta.dirname, "..", "apps");

const apps = readdirSync(appsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .toSorted((left, right) => left.localeCompare(right));

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
    cwd: path.join(appsDirectory, selectedApp),
    stdio: "inherit",
  }
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;

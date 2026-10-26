import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const appDirectory = path.resolve(import.meta.dirname, "..");
const outputDirectory = path.join(appDirectory, ".output", "alchemy-worker");
const siteDirectory = path.join(appDirectory, "dist");

rmSync(outputDirectory, { force: true, recursive: true });

mkdirSync(outputDirectory, { recursive: true });

cpSync(siteDirectory, path.join(outputDirectory, "site"), {
  recursive: true,
});

execFileSync(
  process.execPath,
  [
    "build",
    "src/worker.ts",
    "--target",
    "browser",
    "--format",
    "esm",
    "--outfile",
    path.join(outputDirectory, "index.js"),
  ],
  { cwd: appDirectory, stdio: "inherit" }
);

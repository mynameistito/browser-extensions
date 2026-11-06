import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const cacheKey = createHash("sha256")
  .update(readFileSync(path.join(root, "bun.lock")))
  .update(process.versions.bun ?? "")
  .update(process.versions.node)
  .digest("hex")
  .slice(0, 16);

execFileSync(
  process.execPath,
  [
    path.join(root, "scripts/run-turbo.ts"),
    "run",
    "test",
    "test:root",
    "--concurrency=2",
    ...process.argv.slice(2),
    "--",
    "--fsModuleCachePath",
    `.turbo/vitest-cache-${cacheKey}`,
  ],
  { cwd: root, stdio: "inherit" }
);

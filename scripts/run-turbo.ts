import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const turboBin = require.resolve("turbo/bin/turbo");

execFileSync(process.execPath, [turboBin, ...process.argv.slice(2)], {
  cwd: workspaceRoot,
  env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1" },
  stdio: "inherit",
});

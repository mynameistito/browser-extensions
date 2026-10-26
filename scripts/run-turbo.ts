import { execFileSync } from "node:child_process";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");

execFileSync(process.execPath, ["x", "turbo", ...process.argv.slice(2)], {
  cwd: workspaceRoot,
  env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1" },
  stdio: "inherit",
});

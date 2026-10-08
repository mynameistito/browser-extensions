import { execFileSync } from "node:child_process";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const appDir = process.cwd();
const appNodeModules = path.join(appDir, "node_modules");
const rootNodeModules = path.join(workspaceRoot, "node_modules");

process.env.NODE_PATH = [process.env.NODE_PATH, appNodeModules, rootNodeModules]
  .filter(Boolean)
  .join(path.delimiter);

execFileSync("bun", ["x", "wxt", ...process.argv.slice(2)], {
  cwd: appDir,
  env: process.env,
  stdio: "inherit",
});

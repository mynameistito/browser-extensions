import { spawnSync } from "node:child_process";
import path from "node:path";

import { extensionCatalog } from "./extension-catalog";
import type { ExtensionApp } from "./extension-catalog";

export type AppTaskRunner = (
  app: ExtensionApp,
  task: string
) => { readonly status: number | null; readonly error: Error | undefined };

const runBunTask: AppTaskRunner = (app, task) => {
  const result = spawnSync("bun", ["run", task], {
    cwd: path.resolve(import.meta.dirname, "..", "apps", app.directory),
    stdio: "inherit",
  });
  return { error: result.error, status: result.status };
};

/** Run a required package script in every app, in directory-name order. */
export const runAppTasks = (
  task: string,
  apps: readonly ExtensionApp[] = extensionCatalog,
  runner: AppTaskRunner = runBunTask,
  options: { readonly required?: boolean } = {}
): number => {
  const orderedApps = apps.toSorted((left, right) =>
    left.directory.localeCompare(right.directory)
  );
  const missing = orderedApps.filter((app) => !app.scripts[task]);
  if (options.required && missing.length > 0) {
    console.error(
      `Required app task "${task}" is missing from: ${missing.map((app) => app.name).join(", ")}.`
    );
    return 1;
  }

  for (const app of orderedApps.filter(
    (candidate) => candidate.scripts[task]
  )) {
    const result = runner(app, task);
    if (result.status === 0 && !result.error) {
      continue;
    }
    const reason = result.error
      ? `: ${result.error.message}`
      : ` with exit code ${String(result.status)}`;
    console.error(`App task "${task}" failed for ${app.name}${reason}.`);
    if (result.status && result.status > 0) {
      return result.status;
    }
    return 1;
  }
  return 0;
};

if (import.meta.main) {
  const [task] = process.argv.slice(2);
  if (task) {
    process.exitCode = runAppTasks(task, extensionCatalog, runBunTask, {
      required: true,
    });
  } else {
    console.error("Usage: bun scripts/run-app-tasks.ts <script-name>");
    process.exitCode = 1;
  }
}

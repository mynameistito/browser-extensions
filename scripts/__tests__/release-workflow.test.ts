import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { extensionCatalog } from "../extension-catalog";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const readRepositoryFile = (filePath: string): string =>
  readFileSync(path.join(repositoryRoot, filePath), "utf-8");

describe("root workflows", () => {
  test("release matrix covers each release app once with only its declared key", () => {
    const first = Bun.spawnSync(
      ["bun", "scripts/extension-catalog.ts", "--matrix"],
      { cwd: repositoryRoot, stderr: "pipe", stdout: "pipe" }
    );
    const second = Bun.spawnSync(
      ["bun", "scripts/extension-catalog.ts", "--matrix"],
      { cwd: repositoryRoot, stderr: "pipe", stdout: "pipe" }
    );
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    const matrixOutput = first.stdout.toString().trim();
    expect(second.stdout.toString().trim()).toBe(matrixOutput);
    const { include } = JSON.parse(matrixOutput) as {
      readonly include: readonly {
        readonly app: string;
        readonly chromeSigningSecret?: string;
      }[];
    };
    const expectedApps = extensionCatalog.filter(
      (app) => app.scripts["ci:release"] !== undefined
    );
    expect(include.map((entry) => entry.app)).toEqual(
      expectedApps.map((app) => app.name)
    );
    expect(new Set(include.map((entry) => entry.app)).size).toBe(4);
    expect(
      include.filter((entry) => entry.chromeSigningSecret !== undefined)
    ).toHaveLength(3);
    for (const app of expectedApps) {
      const entry = include.find((item) => item.app === app.name);
      expect(entry?.chromeSigningSecret).toBe(app.chromeSigningSecret);
    }
    expect(include.find((entry) => entry.app === "hide-ip-ext")).toEqual({
      app: "hide-ip-ext",
    });
  });

  test("release workflow consumes the catalog and isolates keyed secrets", () => {
    const workflow = readRepositoryFile(".github/workflows/release.yml");
    expect(workflow).toContain("bun scripts/extension-catalog.ts --matrix");
    expect(workflow).toContain("fromJSON(needs.version.outputs.matrix)");
    expect(workflow).toContain("secrets[matrix.chromeSigningSecret]");
    expect(workflow).toContain("matrix.chromeSigningSecret");
    expect(workflow).toContain("!matrix.chromeSigningSecret");
    expect(
      workflow.match(/bun run --filter \$\{\{ matrix\.app \}\} ci:release/gu)
    ).toHaveLength(2);
    expect(workflow).toContain("bun-version: 1.4.2");
    expect(workflow).toContain("bun install --frozen-lockfile");
    expect(workflow).toContain("bun run prepare:wxt");
  });

  test("root CI keeps new-tab knip and push-only init signing-key gate", () => {
    const workflow = readRepositoryFile(".github/workflows/ci.yml");
    expect(workflow).toContain("task: [check, typecheck, test, build]");
    expect(workflow).toContain("matrix.task != 'build'");
    expect(workflow).toContain("bun run --filter new-tab-ext knip");
    expect(workflow).toContain("github.event_name == 'pull_request'");
    expect(workflow).toContain("github.ref == 'refs/heads/init'");
    expect(workflow).toContain("secrets.NEW_TAB_WXT_CHROME_KEY");
    expect(workflow).toContain("Build new-tab with its persistent Chrome key");
    expect(workflow).toContain('REQUIRE_CHROME_KEY: "1"');
    expect(workflow).toContain(
      "apps/new-tab-ext/.output/chrome-mv3/manifest.json"
    );
    expect(workflow).toContain("manifest.key");
    expect(workflow).toContain("Set the NEW_TAB_WXT_CHROME_KEY Actions secret");
  });
});

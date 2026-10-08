import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  discoverExtensionCatalog,
  extensionCatalog,
  parseExtensionManifest,
  persistentChromeKeyApps,
  validateExtensionApps,
} from "../extension-catalog";
import { runAppTasks } from "../run-app-tasks";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

describe("extension catalog", () => {
  test("discovers the four apps and three keyed apps in deterministic order", () => {
    expect(extensionCatalog.map((app) => app.name)).toEqual([
      "hide-email-ext",
      "hide-ip-ext",
      "new-tab-ext",
      "quote-viewer",
    ]);
    expect(persistentChromeKeyApps.map((app) => app.name)).toEqual([
      "hide-email-ext",
      "new-tab-ext",
      "quote-viewer",
    ]);
    expect(new Set(extensionCatalog.map((app) => app.name)).size).toBe(4);
    expect(
      new Set(persistentChromeKeyApps.map((app) => app.chromeSigningSecret))
        .size
    ).toBe(3);
    expect(
      extensionCatalog.find((app) => app.name === "hide-ip-ext")
        ?.chromeSigningSecret
    ).toBeUndefined();
  });

  test("validates app metadata and package directory identity", () => {
    const directory = mkdtempSync(
      path.join(tmpdir(), "extension-catalog-test-")
    );
    const appDirectory = path.join(directory, "apps", "sample-app");
    const manifestPath = path.join(appDirectory, "package.json");
    mkdirSync(appDirectory, { recursive: true });
    const writeManifest = (manifest: unknown): void =>
      writeFileSync(manifestPath, JSON.stringify(manifest));

    try {
      writeManifest({
        browserExtension: { chromeSigningSecret: "SAMPLE_CHROME_KEY" },
        name: "sample-app",
        scripts: { postinstall: "prepare" },
      });
      expect(parseExtensionManifest(manifestPath, appDirectory)).toMatchObject({
        chromeSigningSecret: "SAMPLE_CHROME_KEY",
        directory: "sample-app",
        name: "sample-app",
      });
      expect(discoverExtensionCatalog(directory)).toHaveLength(1);

      writeManifest({ name: " ", scripts: {} });
      expect(() => parseExtensionManifest(manifestPath, appDirectory)).toThrow(
        "nonempty name"
      );
      writeManifest({ name: "wrong-name", scripts: {} });
      expect(() => parseExtensionManifest(manifestPath, appDirectory)).toThrow(
        "does not match app directory"
      );
      writeManifest({
        browserExtension: { chromeSigningSecret: "not-valid" },
        name: "sample-app",
      });
      expect(() => parseExtensionManifest(manifestPath, appDirectory)).toThrow(
        "Invalid Chrome signing Actions secret"
      );
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  test("rejects duplicate app names and signing secrets", () => {
    const first = {
      chromeSigningSecret: "SAME_SECRET",
      directory: "first",
      name: "first",
      scripts: {},
    } as const;
    expect(() => validateExtensionApps([first, { ...first }])).toThrow(
      "Duplicate extension package name"
    );
    expect(() =>
      validateExtensionApps([
        first,
        { ...first, directory: "second", name: "second" },
      ])
    ).toThrow("Duplicate Chrome signing Actions secret");
  });

  test("prints compact JSON suitable for GitHub Actions output", () => {
    const result = spawnSync(
      "bun",
      [path.join(import.meta.dirname, "../extension-catalog.ts"), "--matrix"],
      { cwd: repositoryRoot, encoding: "utf-8" }
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      `${JSON.stringify({
        include: [
          {
            app: "hide-email-ext",
            chromeSigningSecret: "HIDE_EMAIL_WXT_CHROME_KEY",
          },
          { app: "hide-ip-ext" },
          { app: "new-tab-ext", chromeSigningSecret: "NEW_TAB_WXT_CHROME_KEY" },
          {
            app: "quote-viewer",
            chromeSigningSecret: "QUOTE_VIEWER_WXT_CHROME_KEY",
          },
        ],
      })}\n`
    );
    expect(result.stdout).not.toContain("PRIVATE KEY");
  });
});

describe("runAppTasks", () => {
  const apps = [
    {
      chromeSigningSecret: undefined,
      directory: "second",
      name: "second",
      scripts: { prepare: "prepare" },
    },
    {
      chromeSigningSecret: undefined,
      directory: "first",
      name: "first",
      scripts: { prepare: "prepare" },
    },
  ] as const;

  test("runs each declared task once in deterministic order", () => {
    const calls: string[] = [];
    expect(
      runAppTasks("prepare", apps, (app) => {
        calls.push(app.name);
        return { error: undefined, status: 0 };
      })
    ).toBe(0);
    expect(calls).toEqual(["first", "second"]);
  });

  test("fails clearly when a required task is missing", () => {
    const calls: string[] = [];
    expect(
      runAppTasks(
        "release",
        apps,
        (app) => {
          calls.push(app.name);
          return { error: undefined, status: 0 };
        },
        { required: true }
      )
    ).toBe(1);
    expect(calls).toEqual([]);
  });

  test("skips apps without an optional task", () => {
    const calls: string[] = [];
    const mixedApps = [apps[0], { ...apps[1], scripts: {} }];
    expect(
      runAppTasks("prepare", mixedApps, (app) => {
        calls.push(app.name);
        return { error: undefined, status: 0 };
      })
    ).toBe(0);
    expect(calls).toEqual(["second"]);
  });

  test("stops and propagates child failures", () => {
    const calls: string[] = [];
    expect(
      runAppTasks("prepare", apps, (app) => {
        calls.push(app.name);
        return { error: undefined, status: app.name === "first" ? 7 : 0 };
      })
    ).toBe(7);
    expect(calls).toEqual(["first"]);
  });
});

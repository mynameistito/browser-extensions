import { mkdtempSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

const originalArgv = [...process.argv];
const originalExitCode = process.exitCode;
const originalDirectory = process.cwd();

afterEach(() => {
  process.argv = [...originalArgv];
  process.exitCode = originalExitCode;
  process.chdir(originalDirectory);
  vi.restoreAllMocks();
});

describe("CLI entrypoints", () => {
  test("reports changeset usage errors", async () => {
    process.argv = ["bun", "changeset-add", "unknown"];
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();

    await import("../../scripts/changeset-add");

    expect(error).toHaveBeenCalledWith(
      "Usage: bun run changeset-add <patch|minor|major> <summary>"
    );
    expect(process.exitCode).toBe(1);
  });

  test("creates a changeset and prints its generated path", async () => {
    const changesetDirectory = path.join(originalDirectory, ".changeset");
    const before = new Set(readdirSync(changesetDirectory));
    process.argv = ["bun", "changeset-add", "patch", "Coverage fixture"];
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.resetModules();

    try {
      await import("../../scripts/changeset-add");
      const createdFiles = readdirSync(changesetDirectory).filter(
        (filename) => !before.has(filename)
      );
      expect(createdFiles).toHaveLength(1);
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining(createdFiles[0] ?? "")
      );
      for (const filename of createdFiles) {
        unlinkSync(path.join(changesetDirectory, filename));
      }
    } finally {
      for (const filename of readdirSync(changesetDirectory)) {
        if (!before.has(filename)) {
          unlinkSync(path.join(changesetDirectory, filename));
        }
      }
    }
  });

  test("generates a key and reports CLI errors without touching the project key", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "new-tab-key-cli-"));
    process.chdir(directory);
    process.argv = ["bun", "generate-key"];
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.resetModules();

    try {
      await import("../../scripts/generate-key");
      expect(readdirSync(directory)).toEqual(["key.pem"]);
      expect(log).toHaveBeenCalledWith(
        expect.stringMatching(/^Chrome extension ID: [a-p]{32}$/u)
      );

      process.argv = ["bun", "generate-key", "--unknown"];
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.resetModules();
      await import("../../scripts/generate-key");
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("Unknown option: --unknown")
      );
      expect(process.exitCode).toBe(1);
    } finally {
      process.chdir(originalDirectory);
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

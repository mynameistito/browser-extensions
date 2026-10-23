import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createChangeset } from "../../scripts/changeset-add-core";
import {
  cleanupTestEnvironment,
  setupTestEnvironment,
} from "../helpers/test-environment";

const errorMessage = (result: ReturnType<typeof createChangeset>): string => {
  if (result.kind === "error") {
    return result.message;
  }

  throw new Error("Expected changeset creation to fail.");
};

const createdPath = (result: ReturnType<typeof createChangeset>): string => {
  if (result.kind === "created") {
    return result.relativePath;
  }

  throw new Error("Expected changeset creation to succeed.");
};

const withTempDirectory = async (
  run: (directory: string) => void | Promise<void>
): Promise<void> => {
  const directory = mkdtempSync(path.join(tmpdir(), "new-tab-script-test-"));

  try {
    await run(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
};

describe("release script helpers", () => {
  beforeEach(setupTestEnvironment);
  afterEach(cleanupTestEnvironment);

  it("validates changeset type, summary presence, and non-blank summary", () => {
    const invalidType = createChangeset(["invalid", "summary"], "unused");
    const missingSummary = createChangeset(["patch"], "unused");

    expect(errorMessage(invalidType)).toContain("Usage:");
    expect(errorMessage(missingSummary)).toContain("Usage:");
    expect(createChangeset(["patch", "  "], "unused")).toStrictEqual({
      kind: "error",
      message: "Changeset summary must not be empty.",
    });
  });

  it("writes a formatted changeset, creates directories, and avoids collisions", async () => {
    await withTempDirectory((directory) => {
      const changesets = path.join(directory, "nested", ".changeset");

      const created = createChangeset(
        ["minor", "  Add", "city controls  "],
        changesets,
        "fixed.md"
      );

      expect(createdPath(created)).toContain("fixed.md");
      expect(readFileSync(path.join(changesets, "fixed.md"), "utf-8")).toBe(
        '---\n"new-tab-ext": minor\n---\n\nAdd city controls\n'
      );

      const collision = createChangeset(
        ["patch", "Collision"],
        changesets,
        "fixed.md"
      );

      expect(errorMessage(collision)).toContain("already exists");
    });
  });

  it("generates a random changeset filename", async () => {
    await withTempDirectory((directory) => {
      const changesets = path.join(directory, ".changeset");
      const result = createChangeset(["patch", "Fix a bug"], changesets);
      expect(result.kind).toBe("created");
      expect(readdirSync(changesets)).toStrictEqual([
        expect.stringMatching(/^[a-f0-9]{8}\.md$/u),
      ]);
    });
  });
});

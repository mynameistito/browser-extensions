import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { createChangeset } from "../../scripts/changeset-add-core";

const withTempDirectory = async (
  run: (directory: string) => void | Promise<void>
): Promise<void> => {
  const directory = mkdtempSync(path.join(tmpdir(), "new-tab-script-test-"));
  try {
    await run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("release script helpers", () => {
  test("validates changeset type, summary presence, and non-blank summary", () => {
    expect(createChangeset(["invalid", "summary"], "unused")).toMatchObject({
      kind: "error",
      message: expect.stringContaining("Usage:"),
    });
    expect(createChangeset(["patch"], "unused")).toMatchObject({
      kind: "error",
      message: expect.stringContaining("Usage:"),
    });
    expect(createChangeset(["patch", "  "], "unused")).toEqual({
      kind: "error",
      message: "Changeset summary must not be empty.",
    });
  });

  test("writes a formatted changeset, creates directories, and avoids collisions", async () => {
    await withTempDirectory((directory) => {
      const changesets = path.join(directory, "nested", ".changeset");
      const created = createChangeset(
        ["minor", "  Add", "city controls  "],
        changesets,
        "fixed.md"
      );
      expect(created).toMatchObject({
        kind: "created",
        relativePath: expect.stringContaining("fixed.md"),
      });
      expect(readFileSync(path.join(changesets, "fixed.md"), "utf-8")).toBe(
        '---\n"new-tab-ext": minor\n---\n\nAdd city controls\n'
      );
      expect(
        createChangeset(["patch", "Collision"], changesets, "fixed.md")
      ).toMatchObject({
        kind: "error",
        message: expect.stringContaining("already exists"),
      });
    });
  });

  test("generates a random changeset filename", async () => {
    await withTempDirectory((directory) => {
      const changesets = path.join(directory, ".changeset");
      const result = createChangeset(["patch", "Fix a bug"], changesets);
      expect(result.kind).toBe("created");
      expect(readdirSync(changesets)).toEqual([
        expect.stringMatching(/^[a-f0-9]{8}\.md$/u),
      ]);
    });
  });
});

import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { createChangeset } from "../../scripts/changeset-add-core";
import { generateChromeKey } from "../../scripts/generate-key-core";

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

  test("rejects unknown key options and refuses to replace an existing key", async () => {
    await withTempDirectory((directory) => {
      const keyPath = path.join(directory, "key.pem");
      expect(generateChromeKey(["--unknown"], keyPath)).toMatchObject({
        kind: "error",
        message: expect.stringContaining("Unknown option"),
      });
      writeFileSync(keyPath, "keep this key");
      expect(generateChromeKey([], keyPath)).toMatchObject({
        kind: "error",
        message: expect.stringContaining("Refusing to replace"),
      });
      expect(readFileSync(keyPath, "utf-8")).toBe("keep this key");
    });
  });

  test("generates an RSA key and builds the Unix secret command", async () => {
    await withTempDirectory((directory) => {
      const keyPath = path.join(directory, "key.pem");
      const result = generateChromeKey(["--"], keyPath, "linux");
      expect(result).toMatchObject({
        kind: "generated",
        secretCommand:
          "gh secret set WXT_CHROME_KEY --repo mynameistito/new-tab-ext < key.pem",
      });
      expect(readFileSync(keyPath, "utf-8")).toContain("BEGIN PRIVATE KEY");
      if (result.kind === "generated") {
        expect(result.extensionId).toMatch(/^[a-p]{32}$/u);
      }
    });
  });

  test("force-replaces an existing key and builds the Windows secret command", async () => {
    await withTempDirectory((directory) => {
      const keyPath = path.join(directory, "key.pem");
      writeFileSync(keyPath, "replace this key");
      const result = generateChromeKey(["-f"], keyPath, "win32");
      expect(result).toMatchObject({
        kind: "generated",
        secretCommand:
          "Get-Content key.pem -Raw | gh secret set WXT_CHROME_KEY --repo mynameistito/new-tab-ext",
      });
      expect(readFileSync(keyPath, "utf-8")).toContain("BEGIN PRIVATE KEY");
    });
  });
});

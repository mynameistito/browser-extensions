import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { generateChromeKeyFile } from "../generate-keys-core";

describe("generateChromeKeyFile", () => {
  test("writes a PKCS#8 key and returns its stable Chromium ID", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "extension-key-test-"));
    const keyPath = path.join(directory, "key.pem");

    try {
      const result = generateChromeKeyFile(keyPath, false);
      expect(result.kind).toBe("generated");
      expect(readFileSync(keyPath, "utf-8")).toContain("BEGIN PRIVATE KEY");
      if (result.kind === "generated") {
        expect(result.extensionId).toMatch(/^[a-p]{32}$/u);
      }
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  test("does not overwrite an existing key without explicit force", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "extension-key-test-"));
    const keyPath = path.join(directory, "key.pem");

    try {
      writeFileSync(keyPath, "preserve this key");
      expect(generateChromeKeyFile(keyPath, false)).toMatchObject({
        kind: "error",
        message: expect.stringContaining("already exists"),
      });
      expect(readFileSync(keyPath, "utf-8")).toBe("preserve this key");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

import { describe, expect, test } from "bun:test";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  chromeKeySecrets,
  generateKeyHelp,
  generateChromeKeyFile,
  parseGenerateKeyOptions,
  uploadChromeKey,
} from "../generate-keys-core";

describe("parseGenerateKeyOptions", () => {
  test("prints help for both long and short flags", () => {
    expect(parseGenerateKeyOptions(["--help"])).toEqual({
      kind: "help",
      message: generateKeyHelp,
    });
    expect(parseGenerateKeyOptions(["-h"])).toEqual({
      kind: "help",
      message: generateKeyHelp,
    });
  });

  test("uses the release workflow secret name for each app", () => {
    expect(chromeKeySecrets).toEqual({
      "better-history": "BETTER_HISTORY_WXT_CHROME_KEY",
      "github-settings-repo-copy": "WXT_GITHUB_SETTINGS_REPO_COPY_CHROME_KEY",
      "hide-email-ext": "HIDE_EMAIL_WXT_CHROME_KEY",
      "ig-video-controls": "IG_VIDEO_CONTROLS_WXT_CHROME_KEY",
      "new-tab-ext": "NEW_TAB_WXT_CHROME_KEY",
      "quote-viewer": "QUOTE_VIEWER_WXT_CHROME_KEY",
    });
  });

  test("accepts a repository override for one app", () => {
    expect(
      parseGenerateKeyOptions([
        "--app",
        "quote-viewer",
        "--repo",
        "mynameistito/quote-viewer",
      ])
    ).toMatchObject({
      kind: "ok",
      options: {
        extensions: ["quote-viewer"],
        repository: "mynameistito/quote-viewer",
        upload: false,
      },
    });
  });

  test("accepts Better History as a persistent-key target", () => {
    expect(parseGenerateKeyOptions(["--app", "better-history"])).toMatchObject({
      kind: "ok",
      options: { extensions: ["better-history"] },
    });
  });

  test("accepts all apps with force and upload", () => {
    expect(
      parseGenerateKeyOptions(["--app", "all", "--force", "--upload"])
    ).toMatchObject({
      kind: "ok",
      options: {
        extensions: [
          "better-history",
          "hide-email-ext",
          "quote-viewer",
          "new-tab-ext",
          "ig-video-controls",
          "github-settings-repo-copy",
        ],
        force: true,
        upload: true,
      },
    });
  });

  test("allows direct upload when one app is selected", () => {
    expect(
      parseGenerateKeyOptions(["--app", "quote-viewer", "--upload"])
    ).toMatchObject({
      kind: "ok",
      options: {
        extensions: ["quote-viewer"],
        upload: true,
      },
    });
  });

  test("requires one app when overriding the repo or uploading", () => {
    const repoWithoutApp = parseGenerateKeyOptions(["--repo", "owner/repo"]);

    const invalidRepo = parseGenerateKeyOptions([
      "--app",
      "quote-viewer",
      "--repo",
      "bad",
    ]);

    const uploadWithoutApp = parseGenerateKeyOptions(["--upload"]);

    const allWithRepo = parseGenerateKeyOptions([
      "--app",
      "all",
      "--repo",
      "owner/repo",
    ]);

    expect(repoWithoutApp.kind).toBe("error");

    expect(invalidRepo.kind).toBe("error");

    expect(uploadWithoutApp.kind).toBe("error");
    expect(allWithRepo.kind).toBe("error");

    if (
      repoWithoutApp.kind === "error" &&
      invalidRepo.kind === "error" &&
      uploadWithoutApp.kind === "error" &&
      allWithRepo.kind === "error"
    ) {
      expect(repoWithoutApp.message).toContain("exactly one --app");
      expect(invalidRepo.message).toContain("owner/name");
      expect(uploadWithoutApp.message).toContain("explicit --app target");
      expect(allWithRepo.message).toContain("exactly one --app target");
    }
  });
});

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
      const result = generateChromeKeyFile(keyPath, false);

      expect(result.kind).toBe("error");

      if (result.kind === "error") {
        expect(result.message).toContain("already exists");
      }

      expect(readFileSync(keyPath, "utf-8")).toBe("preserve this key");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  test("restores owner-only permissions when force replaces a key", () => {
    if (process.platform === "win32") {
      return;
    }

    const directory = mkdtempSync(path.join(tmpdir(), "extension-key-test-"));
    const keyPath = path.join(directory, "key.pem");

    try {
      writeFileSync(keyPath, "old key", { mode: 0o644 });
      chmodSync(keyPath, 0o644);

      const result = generateChromeKeyFile(keyPath, true);

      expect(result.kind).toBe("generated");
      expect(statSync(keyPath).mode.toString(8).slice(-3)).toBe("600");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

describe("uploadChromeKey", () => {
  test("sends the key to the configured app secret and repository", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "extension-key-test-"));
    const keyPath = path.join(directory, "key.pem");
    writeFileSync(keyPath, "private test key");
    let command: readonly string[] = [];
    let input = "";

    try {
      const result = uploadChromeKey(
        keyPath,
        "owner/repository",
        chromeKeySecrets["quote-viewer"],
        (args, keyPem) => {
          command = args;
          input = keyPem;

          return { error: null, status: 0 };
        }
      );

      expect(result).toEqual({ kind: "uploaded" });
      expect(command).toEqual([
        "secret",
        "set",
        "QUOTE_VIEWER_WXT_CHROME_KEY",
        "--repo",
        "owner/repository",
      ]);
      expect(input).toBe("private test key");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

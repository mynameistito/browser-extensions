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

import { it, describe, expect } from "vitest";

import {
  chromeKeySecrets,
  generateKeyHelp,
  generateChromeKeyFile,
  parseGenerateKeyOptions,
  uploadChromeKey,
} from "../generate-keys-core";
import type { ParseGenerateKeyOptionsResult } from "../generate-keys-core";

const getErrorMessage = (result: ParseGenerateKeyOptionsResult): string => {
  if (result.kind !== "error") {
    throw new Error("Expected option parsing to fail.");
  }

  return result.message;
};

describe(parseGenerateKeyOptions, () => {
  it("prints help for both long and short flags", () => {
    expect(parseGenerateKeyOptions(["--help"])).toStrictEqual({
      kind: "help",
      message: generateKeyHelp,
    });
    expect(parseGenerateKeyOptions(["-h"])).toStrictEqual({
      kind: "help",
      message: generateKeyHelp,
    });
  });

  it("uses the release workflow secret name for each app", () => {
    expect(chromeKeySecrets).toStrictEqual({
      "better-history": "BETTER_HISTORY_WXT_CHROME_KEY",
      "github-settings-repo-copy": "WXT_GITHUB_SETTINGS_REPO_COPY_CHROME_KEY",
      "hide-email-ext": "HIDE_EMAIL_WXT_CHROME_KEY",
      "ig-video-controls": "IG_VIDEO_CONTROLS_WXT_CHROME_KEY",
      "mute-tab-manager": "MUTE_TAB_MANAGER_WXT_CHROME_KEY",
      "new-tab-ext": "NEW_TAB_WXT_CHROME_KEY",
      "quote-viewer": "QUOTE_VIEWER_WXT_CHROME_KEY",
    });
  });

  it("accepts a repository override for one app", () => {
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

  it("accepts Better History as a persistent-key target", () => {
    expect(parseGenerateKeyOptions(["--app", "better-history"])).toMatchObject({
      kind: "ok",
      options: { extensions: ["better-history"] },
    });
  });

  it("accepts Mute Tab Manager as a persistent-key target", () => {
    expect(
      parseGenerateKeyOptions(["--app", "mute-tab-manager"])
    ).toMatchObject({
      kind: "ok",
      options: { extensions: ["mute-tab-manager"] },
    });
  });

  it("accepts all apps with force and upload", () => {
    const result = parseGenerateKeyOptions([
      "--app",
      "all",
      "--force",
      "--upload",
    ]);

    expect(result).toMatchObject({
      kind: "ok",
      options: {
        extensions: [
          "better-history",
          "hide-email-ext",
          "quote-viewer",
          "new-tab-ext",
          "ig-video-controls",
          "github-settings-repo-copy",
          "mute-tab-manager",
        ],
        force: true,
        upload: true,
      },
    });

    if (result.kind !== "ok") {
      throw new Error("Expected all-app options to parse successfully.");
    }

    expect(result.options.repository).toBeUndefined();
  });

  it("allows direct upload when one app is selected", () => {
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

  it("requires one app when overriding the repo or uploading", () => {
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

    expect(getErrorMessage(repoWithoutApp)).toContain("exactly one --app");
    expect(getErrorMessage(invalidRepo)).toContain("owner/name");
    expect(getErrorMessage(uploadWithoutApp)).toContain(
      "explicit --app target"
    );
    expect(getErrorMessage(allWithRepo)).toContain("exactly one --app target");
  });
});

describe(generateChromeKeyFile, () => {
  it("writes a PKCS#8 key and returns its stable Chromium ID", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "extension-key-test-"));
    const keyPath = path.join(directory, "key.pem");

    try {
      const result = generateChromeKeyFile(keyPath, false);
      expect(result.kind).toBe("generated");
      expect(readFileSync(keyPath, "utf-8")).toContain("BEGIN PRIVATE KEY");

      if (result.kind !== "generated") {
        throw new Error("Expected key generation to succeed.");
      }

      expect(result.extensionId).toMatch(/^[a-p]{32}$/u);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("does not overwrite an existing key without explicit force", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "extension-key-test-"));
    const keyPath = path.join(directory, "key.pem");

    try {
      writeFileSync(keyPath, "preserve this key");
      const result = generateChromeKeyFile(keyPath, false);

      expect(result.kind).toBe("error");

      if (result.kind !== "error") {
        throw new Error("Expected existing key generation to fail.");
      }

      expect(result.message).toContain("already exists");
      expect(readFileSync(keyPath, "utf-8")).toBe("preserve this key");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it.skipIf(process.platform === "win32")(
    "restores owner-only permissions when force replaces a key",
    () => {
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
    }
  );
});

describe(uploadChromeKey, () => {
  it("sends the key to the configured app secret and repository", () => {
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

      expect(result).toStrictEqual({ kind: "uploaded" });
      expect(command).toStrictEqual([
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

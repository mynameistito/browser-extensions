import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const CHANGESET_TYPES = ["patch", "minor", "major"] as const;

type ChangesetType = (typeof CHANGESET_TYPES)[number];

/** Result produced by the changeset creation operation. */
export type ChangesetCreationResult =
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "created"; readonly relativePath: string };

/**
 * Check whether a user supplied value is a supported changeset release type.
 * @param value - Value to validate.
 * @returns True when the value is a supported changeset type.
 */
const isChangesetType = (value: string | undefined): value is ChangesetType =>
  CHANGESET_TYPES.some((type) => type === value);

/**
 * Create a changeset file for one package.
 * @param args - The changeset type followed by the summary words.
 * @param changesetDirectory - Directory where the new file should be written.
 * @param packageName - Package name recorded in the changeset frontmatter.
 * @returns The created relative path, or an input and filename error.
 */
export const createChangeset = (
  args: readonly string[],
  changesetDirectory: string,
  packageName: string
): ChangesetCreationResult => {
  const [requestedType, ...summaryParts] = args;

  if (!isChangesetType(requestedType) || summaryParts.length === 0) {
    return {
      kind: "error",
      message: "Usage: changeset-add <patch|minor|major> <summary>",
    };
  }

  const summary = summaryParts.join(" ").trim();

  if (summary.length === 0) {
    return { kind: "error", message: "Changeset summary must not be empty." };
  }

  mkdirSync(changesetDirectory, { recursive: true });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const filename = `${randomBytes(4).toString("hex")}.md`;
    const changesetPath = path.join(changesetDirectory, filename);

    if (existsSync(changesetPath)) {
      continue;
    }

    const content = `---\n"${packageName}": ${requestedType}\n---\n\n${summary}\n`;
    writeFileSync(changesetPath, content, { flag: "wx" });

    return {
      kind: "created",
      relativePath: path.relative(process.cwd(), changesetPath),
    };
  }

  return {
    kind: "error",
    message: "Could not generate a unique changeset filename.",
  };
};

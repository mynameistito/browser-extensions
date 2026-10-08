import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const changesetTypes = ["patch", "minor", "major"] as const;
type ChangesetType = (typeof changesetTypes)[number];

const isChangesetType = (value: string | undefined): value is ChangesetType =>
  changesetTypes.some((type) => type === value);

export type ChangesetCreationResult =
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "created"; readonly relativePath: string };

/** Create a changeset in the requested directory and report a CLI-ready result. */
export const createChangeset = (
  args: readonly string[],
  changesetDirectory: string,
  filename = `${randomBytes(4).toString("hex")}.md`
): ChangesetCreationResult => {
  const [requestedType, ...summaryParts] = args;

  if (!isChangesetType(requestedType) || summaryParts.length === 0) {
    return {
      kind: "error",
      message: "Usage: bun run changeset-add <patch|minor|major> <summary>",
    };
  }

  const summary = summaryParts.join(" ").trim();

  if (summary.length === 0) {
    return { kind: "error", message: "Changeset summary must not be empty." };
  }
  const changesetPath = path.join(changesetDirectory, filename);
  mkdirSync(changesetDirectory, { recursive: true });

  if (existsSync(changesetPath)) {
    return {
      kind: "error",
      message: "Generated changeset filename already exists; try again.",
    };
  }

  const content = `---\n"new-tab-ext": ${requestedType}\n---\n\n${summary}\n`;
  writeFileSync(changesetPath, content, { flag: "wx" });
  return {
    kind: "created",
    relativePath: path.relative(process.cwd(), changesetPath),
  };
};

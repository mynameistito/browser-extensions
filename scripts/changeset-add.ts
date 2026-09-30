import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const changesetTypes = ["patch", "minor", "major"] as const;
type ChangesetType = (typeof changesetTypes)[number];

const isChangesetType = (value: string | undefined): value is ChangesetType =>
  changesetTypes.some((type) => type === value);

const [requestedType, ...summaryParts] = process.argv.slice(2);

if (!isChangesetType(requestedType) || summaryParts.length === 0) {
  console.error("Usage: bun run changeset-add <patch|minor|major> <summary>");
  process.exitCode = 1;
} else {
  const summary = summaryParts.join(" ").trim();

  if (summary.length === 0) {
    console.error("Changeset summary must not be empty.");
    process.exitCode = 1;
  } else {
    const changesetDirectory = path.resolve(
      import.meta.dirname,
      "../.changeset"
    );
    mkdirSync(changesetDirectory, { recursive: true });

    const filename = `${randomBytes(4).toString("hex")}.md`;
    const changesetPath = path.join(changesetDirectory, filename);

    if (existsSync(changesetPath)) {
      console.error("Generated changeset filename already exists; try again.");
      process.exitCode = 1;
    } else {
      const content = `---\n"new-tab-ext": ${requestedType}\n---\n\n${summary}\n`;
      writeFileSync(changesetPath, content, { flag: "wx" });
      console.log(`Created ${path.relative(process.cwd(), changesetPath)}`);
    }
  }
}

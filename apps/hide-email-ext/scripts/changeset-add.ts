import path from "node:path";

import { createChangeset } from "../../../scripts/changeset-core";

const result = createChangeset(
  process.argv.slice(2),
  path.resolve(import.meta.dirname, "../.changeset"),
  "hide-email-ext"
);

if (result.kind === "error") {
  console.error(result.message);
  process.exitCode = 1;
} else {
  console.log(`Created ${result.relativePath}`);
}

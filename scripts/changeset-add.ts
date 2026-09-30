import path from "node:path";

import { createChangeset } from "./changeset-add-core";

const result = createChangeset(
  process.argv.slice(2),
  path.resolve(import.meta.dirname, "../.changeset")
);

if (result.kind === "error") {
  console.error(result.message);
  process.exitCode = 1;
} else {
  console.log(`Created ${result.relativePath}`);
}

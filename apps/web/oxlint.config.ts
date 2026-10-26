import { defineConfig } from "oxlint";
import astro from "ultracite/oxlint/astro";

import { baseConfig } from "../../oxlint.config.ts";

export default defineConfig({
  extends: [baseConfig, astro],
});

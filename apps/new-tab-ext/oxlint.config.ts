import { defineConfig } from "oxlint";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

import { baseConfig, sharedJsPlugins } from "../../oxlint.config.ts";

const jsPlugins = selectJsPlugins(["react-doctor"]);

export default defineConfig({
  extends: [baseConfig, react, vitest, jsPlugins],
  jsPlugins: [...sharedJsPlugins.jsPlugins, ...jsPlugins.jsPlugins],
  overrides: [
    {
      files: ["src/**"],
      rules: {
        "import/no-relative-parent-imports": "error",
      },
    },
  ],
  settings: jsPluginSettings,
});

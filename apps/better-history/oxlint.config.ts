import { defineConfig } from "oxlint";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";
import tanstack from "ultracite/oxlint/tanstack";
import tanstackJsPlugins from "ultracite/oxlint/tanstack/js-plugins";

import { baseConfig, sharedJsPlugins } from "../../oxlint.config.ts";

const jsPlugins = selectJsPlugins(["react-doctor"]);

export default defineConfig({
  extends: [baseConfig, react, tanstack, tanstackJsPlugins, shadcn, jsPlugins],
  jsPlugins: [
    ...sharedJsPlugins.jsPlugins,
    ...jsPlugins.jsPlugins,
    ...shadcn.jsPlugins,
  ],
  settings: jsPluginSettings,
});

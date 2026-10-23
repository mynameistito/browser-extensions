import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";

export const sharedJsPlugins = selectJsPlugins([
  "github",
  "jsdoc-js",
  "sonarjs",
  "tsdoc",
]);

export const baseConfig = defineConfig({
  env: core.env,
  extends: [core, antiSlop, sharedJsPlugins],
  ignorePatterns: core.ignorePatterns,
  jsPlugins: sharedJsPlugins.jsPlugins,
  settings: jsPluginSettings,
});

export default defineConfig({
  extends: [baseConfig],
  jsPlugins: sharedJsPlugins.jsPlugins,
  options: { typeAware: true },
  settings: jsPluginSettings,
});

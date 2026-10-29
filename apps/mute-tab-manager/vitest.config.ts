import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@/tests",
        replacement: fileURLToPath(new URL("__tests__", import.meta.url)),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("src", import.meta.url)),
      },
    ],
  },
  test: {
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
    environment: "happy-dom",
    include: ["__tests__/**/*.test.{ts,tsx}"],
    setupFiles: [
      "./__tests__/helpers/dom-environment.ts",
      "./__tests__/helpers/chrome-mock.ts",
    ],
  },
});

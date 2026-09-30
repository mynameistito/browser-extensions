import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
      "#imports": fileURLToPath(
        new URL("__tests__/helpers/wxt-imports.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "jsdom",
    include: ["__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["./__tests__/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.ts", "wxt.config.ts"],
      exclude: ["src/**/*.d.ts"],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});

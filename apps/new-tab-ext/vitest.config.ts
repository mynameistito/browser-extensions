import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#imports": fileURLToPath(
        new URL("__tests__/helpers/wxt-imports.ts", import.meta.url)
      ),
      "@": fileURLToPath(new URL("src", import.meta.url)),
      "react-grab": fileURLToPath(
        new URL("__tests__/helpers/react-grab.ts", import.meta.url)
      ),
    },
  },
  test: {
    clearMocks: true,
    coverage: {
      exclude: ["src/**/*.d.ts"],
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.ts", "wxt.config.ts"],
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    environment: "happy-dom",
    include: ["__tests__/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    setupFiles: ["./__tests__/setup.ts"],
  },
});

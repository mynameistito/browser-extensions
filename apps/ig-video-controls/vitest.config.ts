import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#imports": fileURLToPath(
        new URL("__tests__/helpers/wxt-imports.ts", import.meta.url)
      ),
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
  test: {
    coverage: {
      enabled: true,
      include: ["src/**/*.ts"],
      provider: "v8",
      thresholds: { branches: 95, functions: 95, lines: 95, statements: 95 },
    },
    environment: "happy-dom",
    include: ["__tests__/**/*.test.ts"],
  },
});

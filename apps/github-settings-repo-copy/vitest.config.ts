import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      include: ["entrypoints/**/*.ts", "lib/**/*.ts"],
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
    include: ["__tests__/**/*.test.ts"],
  },
});

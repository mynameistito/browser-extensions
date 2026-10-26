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
    environment: "happy-dom",
    include: ["__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["./__tests__/helpers/chrome-mock.ts"],
  },
});

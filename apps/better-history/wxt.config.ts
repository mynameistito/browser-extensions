import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  publicDir: "src/public",
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: "Better History",
    description: "Powerful browser history search, filtering, and cleanup.",
    default_locale: "en",
    permissions: [
      "history",
      "sessions",
      "tabs",
      "storage",
      "unlimitedStorage",
      "contextMenus",
      "alarms",
      "activeTab",
      ...(browser === "chrome" ? ["favicon"] : []),
    ],
    ...(browser === "chrome"
      ? { chrome_url_overrides: { history: "history.html" } }
      : {}),
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: { id: "better-history@mynameistito" },
          },
        }
      : {}),
  }),
  vite: () => ({
    plugins: [
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        routesDirectory: "src/routes",
        generatedRouteTree: "src/routeTree.gen.ts",
      }),
      react(),
      tailwindcss(),
    ],
  }),
});

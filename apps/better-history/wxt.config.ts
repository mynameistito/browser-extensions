import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: ({ browser }) => {
    const base = {
      default_locale: "en",
      description: "__MSG_manifest_description__",
      name: "__MSG_appName__",
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
    };
    if (browser === "firefox") {
      return {
        ...base,
        browser_specific_settings: {
          gecko: { id: "better-history@mynameistito" },
        },
      };
    }
    return {
      ...base,
      chrome_url_overrides: { history: "history.html" },
    };
  },
  manifestVersion: 3,
  publicDir: "src/public",
  srcDir: "src",
  vite: () => ({
    plugins: [
      tanstackRouter({
        autoCodeSplitting: true,
        generatedRouteTree: "src/routeTree.gen.ts",
        routesDirectory: "src/routes",
        target: "react",
      }),
      react(),
      tailwindcss(),
    ],
  }),
});

import { defineConfig } from "blume";

export default defineConfig({
  agents: {
    catalog: true,
    llmsTxt: true,
    skillMd: true,
  },
  content: { root: "docs" },
  deployment: {
    site: "https://browser-ext.mynameistito.com",
  },
  description:
    "Guides and user manuals for browser extensions by mynameistito.",
  github: {
    dir: "apps/web",
    owner: "mynameistito",
    repo: "browser-extensions",
  },
  navigation: {
    actions: [
      {
        href: "https://github.com/mynameistito/browser-extensions",
        label: "GitHub",
      },
    ],
    tabs: [
      { href: "/#extensions", label: "Extensions", path: "/extensions" },
      { href: "/#install", label: "Install", path: "/install" },
      { href: "/#privacy", label: "Privacy", path: "/privacy" },
    ],
  },
  seo: {
    og: { enabled: true },
    robots: true,
    sitemap: true,
    structuredData: true,
  },
  theme: {
    accent: { dark: "#91e6d1", light: "#167c82" },
    mode: "system",
  },
  title: "Browser Extensions",
});

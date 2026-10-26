import { providers, state, Website } from "@alchemy.run/cloudflare";
import { Stack } from "alchemy";
import { gen } from "effect/Effect";

const site = Website.StaticSite(
  "Website",
  Stack.useSync(({ stage }) => ({
    assets: {
      htmlHandling: "drop-trailing-slash",
      notFoundHandling: "404-page",
    },
    command: "bun run build",
    compatibility: { date: "2026-10-26" },
    domains: stage === "prod" ? ["browser-ext.mynameistito.com"] : undefined,
    main: "./src/worker.ts",
    name: "browser-ext",
    observability: {
      logs: { enabled: true, invocationLogs: true, persist: true },
      traces: { enabled: true, headSamplingRate: 1 },
    },
    outdir: "dist",
  }))
);

export default Stack(
  "BrowserExtensionsWeb",
  {
    providers: providers(),
    state: state(),
  },
  gen(function* deploySite() {
    const deployedSite = yield* site;

    return { url: deployedSite.url };
  })
);

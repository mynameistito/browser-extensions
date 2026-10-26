---
name: alchemy-web-deploy
description: Change or troubleshoot the Blume documentation site's Alchemy stack, Cloudflare Worker CI, PR previews, or production deployment in this repository.
---

# Deploy the documentation Worker

1. Read `apps/web/alchemy.run.ts`, `.github/workflows/ci.yml`, and `.github/workflows/deploy-web.yml`. Finish when you understand the stage, artifact, and Changesets deployment gates.
2. Keep production on `browser-ext.mynameistito.com` and the Worker name `browser-ext`. Production deployment is permitted only after `apps/web/package.json` changes version on `main`.
3. Build PR preview artifacts without Cloudflare or GitHub write credentials. Keep the Worker entrypoint and complete `site/` assets in the CI artifact, pin `mynameistito/alchemy-deploy` to a full release SHA, and preserve its exact-CI-run and trusted-action behavior.
4. Do not add deployment credentials to CI build steps or execute a deployment unless the user explicitly requests a live deployment. Finish with web build/typecheck and workflow-gate checks passing.

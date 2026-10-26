---
name: extension-docs-maintainer
description: Update or review the user manuals in apps/web for browser-extension features, setup, permissions, privacy, troubleshooting, and Changesets.
---

# Maintain extension user documentation

1. Read the extension's README, WXT manifest configuration, relevant entrypoints, and privacy documentation. Finish when every documented feature and permission has a source of truth.
2. Update the corresponding page under `apps/web/docs/extensions/` and the catalog at `apps/web/docs/index.mdx` when its summary or navigation changes. Finish when each new claim is supported by code or project documentation.
3. Use only verified installation destinations. Until store pages are supplied, link to the source repository and explain local build installation; never infer a store listing from a similarly named extension.
4. Keep privacy notes specific to the extension. Name external services and what is sent when the code shows a network request; distinguish local processing from data sent to a provider.
5. Run `bun run --filter web build`; the web build runs `blume validate --strict` after building. Resolve build errors and broken links or anchors before finishing.

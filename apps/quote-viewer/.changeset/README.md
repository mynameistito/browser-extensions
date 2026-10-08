# Changesets

Changesets describe release-impacting changes before they are versioned and published.

Use the interactive prompt for normal local development:

```bash
bun run changeset
```

Use the non-interactive helper when automation or an agent needs to create one:

```bash
bun run changeset-add patch "Describe change"
```

Use `patch` for fixes, `minor` for new functionality, and `major` only for breaking changes. Documentation-only, CI-only, or repo-maintenance changes may not need a changeset if they do not affect the extension release.

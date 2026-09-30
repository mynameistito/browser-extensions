# Changesets

Changesets describe user-visible extension changes before they are versioned.

Use the interactive prompt:

```sh
bun run changeset
```

Or create one non-interactively:

```sh
bun run changeset-add patch "Fix a search issue"
bun run changeset-add minor "Add a dashboard feature"
```

Use `patch` for fixes, `minor` for backward-compatible features, and `major` for breaking changes. CI-only and documentation-only changes do not need a changeset.

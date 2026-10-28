# Changesets quick reference

Changesets record user-visible changes before an extension is versioned. Run these commands from `apps/new-tab-ext`.

Create a changeset interactively:

```sh
bun run changeset
```

Or create one without a prompt:

```sh
bun run changeset-add patch "Fix a search issue"
bun run changeset-add minor "Add a dashboard feature"
```

Choose the release level based on the change:

- `patch` for fixes
- `minor` for backward-compatible features
- `major` for breaking changes

CI-only and documentation-only changes do not need a changeset.

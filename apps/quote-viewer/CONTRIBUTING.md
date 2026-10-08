# Contributing

Thanks for helping improve `quote-viewer`. This project is a small browser extension, so the best contributions are focused, tested, and easy to review.

## Before You Start

- Search existing issues and pull requests before opening a new one.
- For bugs, include the browser, extension version, URL type, and what changed on the page.
- For larger changes, open an issue first so the approach can be discussed.
- Do not include secrets, private keys, cookies, tokens, or private account data in issues or pull requests.

## AI-Assisted Contributions

AI tools are allowed, but you are responsible for the final contribution.

- Review AI-generated changes before opening a pull request.
- Verify that the code is correct, minimal, and consistent with this project.
- Run the relevant checks yourself and report what passed or was not run.
- Keep issues and pull requests concise. Do not paste long AI-generated explanations, generic summaries, or boilerplate.
- If AI helped with the implementation, mention it briefly only when it is useful context for reviewers.

## Development Setup

Install dependencies with Bun:

```bash
bun install
```

Run the extension locally:

```bash
bun run dev          # Chromium
bun run dev:firefox  # Firefox
```

Build packages:

```bash
bun run build
bun run build:firefox
bun run zip:all
```

## Quality Checks

Run the relevant checks before opening a pull request:

```bash
bun run typecheck
bun run test
bun run check
bun run knip
```

Use `bun run fix` for automatic formatting and lint fixes.

## Changesets

Most user-visible changes should include a changeset:

```bash
bun run changeset
```

For non-interactive workflows, use:

```bash
bun run changeset-add patch "Describe change"
```

Use `patch` for fixes, `minor` for new functionality, and `major` only for breaking changes.

Documentation-only or CI-only changes may not need a changeset if they do not affect the extension release.

## Pull Request Guidelines

- Keep changes scoped to one purpose.
- Add or update tests for non-trivial logic.
- Prefer small, direct changes over broad refactors.
- Explain browser-specific behavior when relevant.
- Include screenshots or short recordings for visible UI changes when possible.
- Confirm which checks you ran in the pull request description.

## Project Notes

- Source code lives in `src/`.
- Content script logic is in `src/entrypoints/content/`.
- Tweet parsing and quote-route navigation live in `src/lib/tweet.ts`.
- Tests live in `__tests__/`.
- Releases are managed with Changesets and GitHub Actions.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

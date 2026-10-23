<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# PROJECT KNOWLEDGE BASE

## OVERVIEW
Seven independently versioned WXT browser extensions in a Bun workspace. Turbo orchestrates builds, tests, and typechecks; root scripts handle release and signing-key tooling.

## STRUCTURE
```text
apps/       Seven standalone extension packages; see apps/AGENTS.md
scripts/    Shared Node/Bun release, WXT, Changeset, and signing-key utilities
.github/    CI and app-specific release workflows
.changeset/ Per-app release notes consumed by Changesets
```

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| Understand an extension | `apps/<name>/` | Each app owns its WXT config, manifest, dependencies, and release version. |
| Shared app conventions | `apps/AGENTS.md` | WXT invocation, package layout differences, checks. |
| Better History architecture | `apps/better-history/AGENTS.md` | React surfaces, routes, background and features. |
| Instagram video controls | `apps/ig-video-controls/AGENTS.md` | Content-script modules and media integration. |
| New-tab app instructions | `apps/new-tab-ext/AGENTS.md` | Includes issue tracker and domain-doc pointers. |
| Shared release/build tooling | `scripts/AGENTS.md` | Scripts are shared by app packages. |
| Workspace commands | `package.json`, `turbo.json` | Root tasks and Turbo caching. |
| Compiler baseline | `tsconfig.base.json` | Strict TS settings inherited by app configs. |

## CODE MAP
| Symbol/file | Role |
| --- | --- |
| `scripts/run-wxt.ts` | Runs WXT in the calling app directory and exposes root dependencies. |
| `scripts/release-app.ts` | Validates app release state, runs declared checks, creates GitHub release assets. |
| `scripts/generate-keys-core.ts` | Testable key generation/options/upload logic. |
| `scripts/changeset-core.ts` | Shared Changeset generation logic. |
| `apps/*/wxt.config.ts` | Per-app browser extension configuration. |

## CONVENTIONS
- Use Bun (`bun@1.4.2`) and workspace scripts; app dependencies and check scripts are not uniform.
- All app TypeScript configs inherit strict compiler options from the root baseline.
- WXT source roots differ: some apps use package-root `entrypoints/`, others use `src/entrypoints/`. Follow the app's `wxt.config.ts`; do not relocate files based on another app.
- App versions and releases are independent. Use Changesets rather than editing versions directly.
- Shared lint/format config is at the root (`oxlint.config.ts`, `oxfmt.config.ts`); some apps layer local Oxlint config.

## ANTI-PATTERNS (THIS PROJECT)
- Do not assume every app has the same test, check, or typecheck scripts; inspect its `package.json` before invoking app-local tasks.
- Do not invoke WXT from the repository root directly. The wrapper uses the caller's current directory as the app workspace.
- Do not overwrite existing signing keys unless intentionally rotating extension IDs and passing the explicit force option.
- Do not treat `.wxt/` or generated `routeTree.gen.ts` as ordinary hand-maintained source.

## COMMANDS
```text
bun install                         Install workspace dependencies
bun run prepare:wxt                 Generate WXT app-local types
bun run build                       Build all apps
bun run test                        Run app test tasks declared to Turbo
bun run typecheck                   Typecheck apps and root scripts
bun run check                       Run repository Ultracite checks
bun run changeset                   Create a Changeset
bun run changeset-add <app> <level> "summary"  Create an app Changeset
bun run generate-keys --help        Show signing-key options
```

## NOTES
- Root `test` delegates to Turbo; only packages declaring a test task run, and the root `scripts/__tests__` suite is not directly included by that script.
- Most app build scripts create Chrome and Firefox outputs. Inspect package scripts for exact platform coverage before relying on a build command.
- `hide-ip-ext` currently does not use a persistent Chrome signing key.

# SHARED SCRIPT MAP

## OVERVIEW
Root-level Bun/Node TypeScript utilities used by the workspace and individual app packages.

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| WXT CLI bridge | `run-wxt.ts` | Run with an app as the current working directory. |
| App release orchestration | `release-app.ts` | Reads the current app package and invokes its declared release checks. |
| Signing-key CLI | `generate-keys.ts` | Argument handling and per-app key generation orchestration. |
| Signing-key logic | `generate-keys-core.ts`, `chrome-extension-key.ts` | Core operations and key/secret mapping. |
| Changeset helper | `changeset-add.ts`, `changeset-core.ts` | Root Changeset command and shared generation logic. |
| Tests | `__tests__/` | Root script tests; not automatically run by root Turbo `test`. |

## CONVENTIONS
- Keep command-line side effects in the thin entrypoint and put reusable behavior in `*-core.ts` modules where practical.
- Resolve workspace paths from `import.meta.dirname`; app-specific scripts may be invoked with an app working directory, so do not silently rely on repository-root `process.cwd()` unless that is the intended contract.
- Use `node:child_process` `execFileSync` with argument arrays for external commands; propagate the intended cwd and stdio explicitly.
- Key generation refuses to replace existing key files by default. Force replacement changes the extension identity and must remain explicit.
- Release orchestration can run checks, write `.output/release-notes.md`, and create a GitHub release; inspect its behavior before invoking it.

## TESTING
Root tests use Bun's test runner. Test extracted core logic without invoking external release or GitHub commands; run an individual test with `bun test scripts/__tests__/generate-keys.test.ts`.

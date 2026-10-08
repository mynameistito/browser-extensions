# Issue tracker: GitHub

Issues and planning artifacts for this repository live in GitHub Issues. Use the `gh` CLI and pass `--repo mynameistito/new-tab-ext` when the repository is not unambiguous.

## Conventions

- Create issues with `gh issue create`; read them with `gh issue view <number> --comments`.
- List issues with `gh issue list`; label with `gh issue edit <number> --add-label <label>`; comment with `gh issue comment <number>`; close with `gh issue close <number>`.
- When creating issue, pull request, review, or comment bodies, write the Markdown to a temporary file and use `--body-file`.
- PRs are not a request surface for triage.

## Wayfinding operations

- The map is one issue labeled `wayfinder:map`, containing Destination, Notes, Decisions so far, Not yet specified, and Out of scope sections.
- Each decision ticket is a GitHub sub-issue of the map, labeled `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- Use GitHub's native issue dependencies for blockers. Add a dependency through `POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by`, with the blocking issue's numeric database ID as `issue_id`. If native dependencies are unavailable, record `Blocked by: #<number>` in the ticket body.
- The frontier is the map's open, unblocked, unassigned child issues. Claim a ticket by assigning it to yourself before work.
- Resolve a ticket by commenting with the decision, closing it, and appending a concise linked gist to the map's Decisions so far.

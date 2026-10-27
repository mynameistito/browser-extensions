import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("release workflow", () => {
  const workflow = readFileSync(".github/workflows/release.yml", "utf-8");

  it("only starts release work for successful main push CI", () => {
    expect(workflow).toContain("workflows: [CI]");
    expect(workflow).toContain(
      "github.event.workflow_run.conclusion == 'success'"
    );
    expect(workflow).toContain("github.event.workflow_run.event == 'push'");
    expect(workflow).toContain(
      "github.event.workflow_run.head_branch == 'main'"
    );
  });

  it("serializes runs and pins checkouts and Changesets to the tested commit", () => {
    expect(workflow).toContain("group: release-main\n  queue: max");
    expect(
      workflow.match(/ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/gu)
    ).toHaveLength(3);
    expect(workflow).toMatch(
      /GITHUB_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/u
    );
    expect(workflow).toContain("if: steps.stale.outputs.current == 'true'");
  });
});

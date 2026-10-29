import { describe, expect, it } from "vitest";

import { getRepositoryName } from "../lib/repository-path";

describe("repository path parsing", () => {
  it("returns the owner/repository for settings paths", () => {
    expect(getRepositoryName("/acme/widgets/settings/danger")).toBe(
      "acme/widgets"
    );
    expect(getRepositoryName("/acme/widgets/settings")).toBe("acme/widgets");
  });

  it("rejects paths outside repository settings", () => {
    expect(getRepositoryName("/acme/widgets/issues")).toBeNull();
    expect(getRepositoryName("/acme")).toBeNull();
    expect(getRepositoryName("/acme/widgets")).toBeNull();
  });
});

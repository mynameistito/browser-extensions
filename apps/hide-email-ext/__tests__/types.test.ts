import { describe, expect, it } from "vitest";

import { REDACTION_TOKEN } from "../src/lib/types";

describe("types", () => {
  it("REDACTION_TOKEN is the expected redaction placeholder", () => {
    expect(REDACTION_TOKEN).toBe("[Email Redacted]");
  });
});

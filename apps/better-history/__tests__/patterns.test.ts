import { describe, expect, it } from "vitest";

import { anyRuleMatches, ruleMatches, shouldDelete } from "../src/lib/patterns";
import type { DomainRule } from "../src/lib/schemas";

describe("ruleMatches: exact", () => {
  const rule: DomainRule = { kind: "exact", pattern: "example.com" };

  it("matches bare host", () => {
    expect(ruleMatches(rule, "https://example.com/foo")).toBeTruthy();
  });

  it("matches www", () => {
    expect(ruleMatches(rule, "https://www.example.com/foo")).toBeTruthy();
  });

  it("rejects subdomain", () => {
    expect(ruleMatches(rule, "https://blog.example.com/")).toBeFalsy();
  });

  it("rejects different domain", () => {
    expect(ruleMatches(rule, "https://other.com/")).toBeFalsy();
  });
});

describe("ruleMatches: subdomain", () => {
  const rule: DomainRule = { kind: "subdomain", pattern: "example.com" };

  it("matches root", () => {
    expect(ruleMatches(rule, "https://example.com/")).toBeTruthy();
  });

  it("matches one level sub", () => {
    expect(ruleMatches(rule, "https://blog.example.com/")).toBeTruthy();
  });

  it("matches deep sub", () => {
    expect(ruleMatches(rule, "https://a.b.example.com/")).toBeTruthy();
  });

  it("rejects sibling domain", () => {
    expect(ruleMatches(rule, "https://notexample.com/")).toBeFalsy();
  });
});

describe("ruleMatches: specific-sub", () => {
  const rule: DomainRule = {
    kind: "specific-sub",
    pattern: "blog.example.com",
  };

  it("matches that sub", () => {
    expect(ruleMatches(rule, "https://blog.example.com/x")).toBeTruthy();
  });

  it("rejects different sub", () => {
    expect(ruleMatches(rule, "https://news.example.com/")).toBeFalsy();
  });

  it("rejects root", () => {
    expect(ruleMatches(rule, "https://example.com/")).toBeFalsy();
  });
});

describe("ruleMatches: path", () => {
  const rule: DomainRule = {
    kind: "path",
    pattern: "https://example.com/docs",
  };

  it("matches exact path", () => {
    expect(ruleMatches(rule, "https://example.com/docs")).toBeTruthy();
  });

  it("matches deeper path", () => {
    expect(ruleMatches(rule, "https://example.com/docs/intro")).toBeTruthy();
  });

  it("matches the root path prefix", () => {
    expect(
      ruleMatches(
        { kind: "path", pattern: "https://example.com/" },
        "https://example.com/docs/intro"
      )
    ).toBeTruthy();
  });

  it("matches a trailing-slash prefix without the slash", () => {
    expect(
      ruleMatches(
        { kind: "path", pattern: "https://example.com/docs/" },
        "https://example.com/docs"
      )
    ).toBeTruthy();
  });

  it("rejects sibling path with shared prefix", () => {
    expect(ruleMatches(rule, "https://example.com/docs-private")).toBeFalsy();
  });

  it("rejects sibling path", () => {
    expect(ruleMatches(rule, "https://example.com/blog")).toBeFalsy();
  });
});

describe("ruleMatches: page", () => {
  const rule: DomainRule = {
    kind: "page",
    pattern: "https://example.com/docs/intro",
  };

  it("matches exact page", () => {
    expect(ruleMatches(rule, "https://example.com/docs/intro")).toBeTruthy();
  });

  it("rejects deeper", () => {
    expect(ruleMatches(rule, "https://example.com/docs/intro/x")).toBeFalsy();
  });
});

describe(anyRuleMatches, () => {
  it("ors rules", () => {
    const rules: DomainRule[] = [
      { kind: "exact", pattern: "a.com" },
      { kind: "subdomain", pattern: "b.com" },
    ];

    expect(anyRuleMatches(rules, "https://x.b.com/")).toBeTruthy();
    expect(anyRuleMatches(rules, "https://c.com/")).toBeFalsy();
  });
});

describe("shouldDelete: precedence", () => {
  const black: DomainRule[] = [{ kind: "subdomain", pattern: "example.com" }];
  const white: DomainRule[] = [{ kind: "exact", pattern: "example.com" }];

  it("whitelist beats blacklist when precedence true", () => {
    expect(
      shouldDelete("https://example.com/", black, white, true)
    ).toBeFalsy();
  });

  it("subdomain still deleted when whitelist only covers root", () => {
    expect(
      shouldDelete("https://x.example.com/", black, white, true)
    ).toBeTruthy();
  });

  it("blacklist wins when precedence false", () => {
    expect(
      shouldDelete("https://example.com/", black, white, false)
    ).toBeTruthy();
  });

  it("clean url not deleted", () => {
    expect(shouldDelete("https://other.com/", black, white, true)).toBeFalsy();
  });
});

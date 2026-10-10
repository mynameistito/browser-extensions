/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { anyRuleMatches, ruleMatches, shouldDelete } from "@/lib/patterns";
import type { DomainRule } from "@/lib/schemas";

describe("ruleMatches: exact", () => {
  const rule: DomainRule = { kind: "exact", pattern: "example.com" };

  test("matches bare host", () => {
    expect(ruleMatches(rule, "https://example.com/foo")).toBe(true);
  });
  test("matches www", () => {
    expect(ruleMatches(rule, "https://www.example.com/foo")).toBe(true);
  });
  test("rejects subdomain", () => {
    expect(ruleMatches(rule, "https://blog.example.com/")).toBe(false);
  });
  test("rejects different domain", () => {
    expect(ruleMatches(rule, "https://other.com/")).toBe(false);
  });
});

describe("ruleMatches: subdomain", () => {
  const rule: DomainRule = { kind: "subdomain", pattern: "example.com" };
  test("matches root", () => {
    expect(ruleMatches(rule, "https://example.com/")).toBe(true);
  });
  test("matches one level sub", () => {
    expect(ruleMatches(rule, "https://blog.example.com/")).toBe(true);
  });
  test("matches deep sub", () => {
    expect(ruleMatches(rule, "https://a.b.example.com/")).toBe(true);
  });
  test("rejects sibling domain", () => {
    expect(ruleMatches(rule, "https://notexample.com/")).toBe(false);
  });
});

describe("ruleMatches: specific-sub", () => {
  const rule: DomainRule = {
    kind: "specific-sub",
    pattern: "blog.example.com",
  };
  test("matches that sub", () => {
    expect(ruleMatches(rule, "https://blog.example.com/x")).toBe(true);
  });
  test("rejects different sub", () => {
    expect(ruleMatches(rule, "https://news.example.com/")).toBe(false);
  });
  test("rejects root", () => {
    expect(ruleMatches(rule, "https://example.com/")).toBe(false);
  });
});

describe("ruleMatches: path", () => {
  const rule: DomainRule = {
    kind: "path",
    pattern: "https://example.com/docs",
  };
  test("matches exact path", () => {
    expect(ruleMatches(rule, "https://example.com/docs")).toBe(true);
  });
  test("matches deeper path", () => {
    expect(ruleMatches(rule, "https://example.com/docs/intro")).toBe(true);
  });
  test("rejects sibling path", () => {
    expect(ruleMatches(rule, "https://example.com/blog")).toBe(false);
  });
});

describe("ruleMatches: page", () => {
  const rule: DomainRule = {
    kind: "page",
    pattern: "https://example.com/docs/intro",
  };
  test("matches exact page", () => {
    expect(ruleMatches(rule, "https://example.com/docs/intro")).toBe(true);
  });
  test("rejects deeper", () => {
    expect(ruleMatches(rule, "https://example.com/docs/intro/x")).toBe(false);
  });
});

describe("anyRuleMatches", () => {
  test("ors rules", () => {
    const rules: DomainRule[] = [
      { kind: "exact", pattern: "a.com" },
      { kind: "subdomain", pattern: "b.com" },
    ];
    expect(anyRuleMatches(rules, "https://x.b.com/")).toBe(true);
    expect(anyRuleMatches(rules, "https://c.com/")).toBe(false);
  });
});

describe("shouldDelete: precedence", () => {
  const black: DomainRule[] = [{ kind: "subdomain", pattern: "example.com" }];
  const white: DomainRule[] = [{ kind: "exact", pattern: "example.com" }];

  test("whitelist beats blacklist when precedence true", () => {
    expect(shouldDelete("https://example.com/", black, white, true)).toBe(
      false
    );
  });
  test("subdomain still deleted when whitelist only covers root", () => {
    expect(shouldDelete("https://x.example.com/", black, white, true)).toBe(
      true
    );
  });
  test("blacklist wins when precedence false", () => {
    expect(shouldDelete("https://example.com/", black, white, false)).toBe(
      true
    );
  });
  test("clean url not deleted", () => {
    expect(shouldDelete("https://other.com/", black, white, true)).toBe(false);
  });
});

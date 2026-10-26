import { it, describe, expect } from "vitest";

import { isEmail, normalize } from "../src/lib/email";

describe("email helpers", () => {
  it("accepts valid email strings after trimming and lowercasing", () => {
    expect(isEmail("USER@example.com")).toBeTruthy();
    expect(isEmail("  user.name+tag@example.co.uk  ")).toBeTruthy();
  });

  it("rejects non-email values", () => {
    expect(isEmail("user@example")).toBeFalsy();
    expect(isEmail("user @example.com")).toBeFalsy();
    expect(isEmail("user@example .com")).toBeFalsy();
  });

  it("normalizes emails for stable storage and matching", () => {
    const normalized = normalize("  USER.Name+Tag@Example.COM  ");

    expect(String(normalized)).toBe("user.name+tag@example.com");
  });
});

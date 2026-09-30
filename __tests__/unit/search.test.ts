import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { createSearchUrl } from "../../src/lib/search";

describe("createSearchUrl", () => {
  test("creates an encoded Google search URL", () => {
    const url = Effect.runSync(createSearchUrl("web", "  effect typescript  "));

    expect(url.origin).toBe("https://www.google.com");
    expect(url.pathname).toBe("/search");
    expect(url.searchParams.get("q")).toBe("effect typescript");
  });

  test("creates a ChatGPT prompt URL", () => {
    const url = Effect.runSync(createSearchUrl("chatgpt", "Explain Effect"));

    expect(url.origin).toBe("https://chatgpt.com");
    expect(url.searchParams.get("q")).toBe("Explain Effect");
  });

  test("fails with a typed error for a blank query", () => {
    const result = Effect.runSync(Effect.either(createSearchUrl("web", "   ")));

    expect(result._tag).toBe("Left");
  });
});

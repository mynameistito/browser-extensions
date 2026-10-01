import { describe, expect, test, vi } from "vitest";

describe("production-mode entrypoint", () => {
  test("does not attempt to load React Grab outside development", async () => {
    document.body.textContent = "";
    vi.stubEnv("DEV", false);

    await expect(import("../../src/entrypoints/newtab/main")).rejects.toThrow(
      "The new-tab root element is missing."
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanupTestEnvironment,
  setupTestEnvironment,
} from "../helpers/test-environment";

describe("production-mode entrypoint", () => {
  beforeEach(setupTestEnvironment);
  afterEach(cleanupTestEnvironment);

  it("does not attempt to load React Grab outside development", async () => {
    document.body.textContent = "";
    vi.stubEnv("DEV", false);

    await expect(import("../../src/entrypoints/newtab/main")).rejects.toThrow(
      "The new-tab root element is missing."
    );
  });
});

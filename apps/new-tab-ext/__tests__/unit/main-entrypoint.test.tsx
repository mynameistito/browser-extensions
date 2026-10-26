import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, vi, it } from "vitest";

import { requireNewTabRoot } from "../../src/entrypoints/newtab/root";
import {
  cleanupTestEnvironment,
  setupTestEnvironment,
} from "../helpers/test-environment";

describe("new-tab entrypoint", () => {
  beforeEach(setupTestEnvironment);
  afterEach(cleanupTestEnvironment);

  it("requires the extension page root", () => {
    expect(() => requireNewTabRoot(null)).toThrow(
      "The new-tab root element is missing."
    );

    const root = document.createElement("div");
    expect(requireNewTabRoot(root)).toBe(root);
  });

  it("mounts the React app into the new-tab root", async () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.replaceChildren(root);
    vi.stubEnv("MODE", "development");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({}))
    );

    await act(async () => {
      await import("../../src/entrypoints/newtab/main");
    });

    await expect(
      vi.waitFor(() => root.querySelector(".new-tab"))
    ).resolves.not.toBeNull();
    await expect(
      vi.waitFor(() => document.documentElement.dataset.reactGrabLoaded)
    ).resolves.toBe("true");
  });
});

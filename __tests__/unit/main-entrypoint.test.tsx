import { act } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { requireNewTabRoot } from "../../src/entrypoints/newtab/root";

describe("new-tab entrypoint", () => {
  test("requires the extension page root", () => {
    expect(() => requireNewTabRoot(null)).toThrow(
      "The new-tab root element is missing."
    );

    const root = document.createElement("div");
    expect(requireNewTabRoot(root)).toBe(root);
  });

  test("mounts the React app into the new-tab root", async () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.replaceChildren(root);
    vi.stubEnv("MODE", "development");

    await act(async () => {
      await import("../../src/entrypoints/newtab/main");
    });

    expect(
      await vi.waitFor(() => root.querySelector(".new-tab"))
    ).not.toBeNull();
    expect(
      await vi.waitFor(() => document.documentElement.dataset.reactGrabLoaded)
    ).toBe("true");
  });
});

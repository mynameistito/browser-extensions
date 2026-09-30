import { act } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

describe("new-tab entrypoint", () => {
  test("throws when the extension page has no root element", async () => {
    document.body.textContent = "";
    await expect(
      import("../../src/entrypoints/newtab/main?without-root")
    ).rejects.toThrow("The new-tab root element is missing.");
  });

  test("mounts the React app into the new-tab root", async () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.replaceChildren(root);
    await act(async () => {
      await import("../../src/entrypoints/newtab/main?with-root");
    });

    expect(
      await vi.waitFor(() => root.querySelector(".new-tab"))
    ).not.toBeNull();
  });
});

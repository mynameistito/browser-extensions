import { afterEach, describe, expect, it, vi } from "vitest";

import { copyTextToClipboard } from "../lib/clipboard";

describe("clipboard writing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, "execCommand");
  });

  it("uses the Clipboard API when it succeeds", async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockResolvedValue();

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const execCommand = vi.fn<(command: string) => boolean>();
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    await expect(copyTextToClipboard("acme/widgets")).resolves.toBeTruthy();
    expect(writeText).toHaveBeenCalledWith("acme/widgets");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("falls back to a temporary selected field when the API rejects", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi
          .fn<() => Promise<void>>()
          .mockRejectedValue(new Error("denied")),
      },
    });

    const button = document.createElement("button");
    document.body.append(button);
    button.focus();

    let copiedText = "";

    const execCommand = vi.fn<(command: string) => boolean>((command) => {
      copiedText = document.querySelector("textarea")?.value ?? "";

      return command === "copy";
    });

    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    await expect(copyTextToClipboard("acme/widgets")).resolves.toBeTruthy();
    expect(copiedText).toBe("acme/widgets");
    expect(document.querySelector("textarea")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("returns false when both clipboard mechanisms fail", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi
          .fn<() => Promise<void>>()
          .mockRejectedValue(new Error("denied")),
      },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn<(command: string) => boolean>().mockReturnValue(false),
    });

    await expect(copyTextToClipboard("acme/widgets")).resolves.toBeFalsy();
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("keeps non-HTML focus intact during fallback cleanup", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi
          .fn<() => Promise<void>>()
          .mockRejectedValue(new Error("denied")),
      },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn<(command: string) => boolean>().mockReturnValue(true),
    });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("tabindex", "0");
    document.body.append(svg);
    svg.focus();

    await expect(copyTextToClipboard("acme/widgets")).resolves.toBeTruthy();
    expect(document.activeElement).toBe(svg);
  });
});

import { describe, expect, it, vi } from "vitest";

describe("popup storage initialization", () => {
  it("popup rejects missing or incorrectly typed required elements", async () => {
    document.body.replaceChildren(
      Object.assign(document.createElement("div"), { id: "email-input" })
    );
    vi.resetModules();

    await expect(import("../entrypoints/popup/popup")).rejects.toThrow(
      "Element #email-input not found or wrong type"
    );
  });

  it("logs popup initialization failures when a storage subscription throws", async () => {
    document.body.replaceChildren(
      Object.assign(document.createElement("input"), { id: "email-input" }),
      Object.assign(document.createElement("button"), { id: "add-btn" }),
      Object.assign(document.createElement("span"), { id: "error" }),
      Object.assign(document.createElement("ul"), { id: "email-list" }),
      Object.assign(document.createElement("input"), { id: "hide-ip-toggle" })
    );

    Object.defineProperties(globalThis, {
      HTMLButtonElement: {
        configurable: true,
        value: window.HTMLButtonElement,
      },
      HTMLInputElement: {
        configurable: true,
        value: window.HTMLInputElement,
      },
      HTMLSpanElement: { configurable: true, value: window.HTMLSpanElement },
      HTMLUListElement: { configurable: true, value: window.HTMLUListElement },
    });

    vi.resetModules();

    const { hiddenEmailsItem: popupStorageItem } =
      await import("../src/lib/storage");

    const originalWatch = Object.getOwnPropertyDescriptor(
      popupStorageItem,
      "watch"
    );

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      Object.defineProperty(popupStorageItem, "watch", {
        configurable: true,
        value: () => {
          throw new Error("watch failed");
        },
        writable: true,
      });

      await import("../entrypoints/popup/popup");
      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "Popup init failed:",
          expect.any(Error)
        );
      });
    } finally {
      consoleError.mockRestore();

      if (originalWatch === undefined) {
        Reflect.deleteProperty(popupStorageItem, "watch");
      } else {
        Object.defineProperty(popupStorageItem, "watch", originalWatch);
      }
    }
  });

  it("logs unexpected failures from the popup Enter handler", async () => {
    const input = Object.assign(document.createElement("input"), {
      id: "email-input",
    });

    document.body.replaceChildren(
      input,
      Object.assign(document.createElement("button"), { id: "add-btn" }),
      Object.assign(document.createElement("span"), { id: "error" }),
      Object.assign(document.createElement("ul"), { id: "email-list" }),
      Object.assign(document.createElement("input"), { id: "hide-ip-toggle" })
    );

    Object.defineProperties(globalThis, {
      HTMLButtonElement: {
        configurable: true,
        value: window.HTMLButtonElement,
      },
      HTMLInputElement: {
        configurable: true,
        value: window.HTMLInputElement,
      },
      HTMLSpanElement: { configurable: true, value: window.HTMLSpanElement },
      HTMLUListElement: { configurable: true, value: window.HTMLUListElement },
    });

    vi.resetModules();

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      await import("../entrypoints/popup/popup");
      Object.defineProperty(input, "value", {
        configurable: true,
        get: () => {
          throw new Error("input value unavailable");
        },
      });

      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "handleAdd failed:",
          expect.any(Error)
        );
      });
    } finally {
      consoleError.mockRestore();
      Reflect.deleteProperty(input, "value");
    }
  });
});

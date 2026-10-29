import { describe, expect, it, vi } from "vitest";

import { expectErrorText } from "./storage-test-helpers";

describe("popup storage initialization", () => {
  it("popup renders watcher values and treats null as an empty list", async () => {
    document.body.replaceChildren(
      Object.assign(document.createElement("input"), { id: "email-input" }),
      Object.assign(document.createElement("input"), { id: "hide-ip-toggle" }),
      Object.assign(document.createElement("button"), { id: "add-btn" }),
      Object.assign(document.createElement("span"), { id: "error" }),
      Object.assign(document.createElement("ul"), { id: "email-list" })
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

    const {
      getHideIpAddresses,
      hiddenEmailsItem: popupStorageItem,
      setHideIpAddresses,
    } = await import("../src/lib/storage");

    await setHideIpAddresses(false);

    const originalWatch = Object.getOwnPropertyDescriptor(
      popupStorageItem,
      "watch"
    );

    Object.defineProperty(popupStorageItem, "watch", {
      configurable: true,
      value: (listener: (value: string[] | null) => void) => {
        listener(null);
        listener(["watcher@example.com"]);
      },
    });

    try {
      await import("../entrypoints/popup/popup");
      expect(document.querySelector("#email-list")?.textContent).toBe(
        "watcher@example.com×"
      );

      const hideIpToggle =
        document.querySelector<HTMLInputElement>("#hide-ip-toggle");

      await vi.waitFor(() => {
        expect(hideIpToggle?.checked).toBeFalsy();
      });

      if (hideIpToggle === null) {
        throw new TypeError("Expected the Hide IP checkbox");
      }

      hideIpToggle.checked = true;
      hideIpToggle.dispatchEvent(new Event("change", { bubbles: true }));
      await vi.waitFor(async () => {
        await expect(getHideIpAddresses()).resolves.toBeTruthy();
      });
    } finally {
      if (originalWatch === undefined) {
        Reflect.deleteProperty(popupStorageItem, "watch");
      } else {
        Object.defineProperty(popupStorageItem, "watch", originalWatch);
      }
    }
  });

  it("popup restores IP masking after a save error and handles unknown failures", async () => {
    document.body.replaceChildren(
      Object.assign(document.createElement("input"), { id: "email-input" }),
      Object.assign(document.createElement("input"), { id: "hide-ip-toggle" }),
      Object.assign(document.createElement("button"), { id: "add-btn" }),
      Object.assign(document.createElement("span"), { id: "error" }),
      Object.assign(document.createElement("ul"), { id: "email-list" })
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

    const { hideIpAddressesItem } = await import("../src/lib/storage");

    const originalSetValue = Object.getOwnPropertyDescriptor(
      hideIpAddressesItem,
      "setValue"
    );

    const originalGetValue = Object.getOwnPropertyDescriptor(
      hideIpAddressesItem,
      "getValue"
    );

    const nonErrorFailure: unknown = Object.freeze({ reason: "write failed" });

    try {
      Object.defineProperty(hideIpAddressesItem, "setValue", {
        configurable: true,
        value: async () => {
          await Promise.resolve();
          throw new Error("write failed");
        },
        writable: true,
      });
      Object.defineProperty(hideIpAddressesItem, "getValue", {
        configurable: true,
        value: async () => await Promise.resolve(false),
        writable: true,
      });

      await import("../entrypoints/popup/popup");

      const hideIpToggle =
        document.querySelector<HTMLInputElement>("#hide-ip-toggle");

      const error = document.querySelector<HTMLSpanElement>("#error");

      if (hideIpToggle === null || error === null) {
        throw new TypeError("Expected the Hide IP checkbox and error label");
      }

      hideIpToggle.checked = true;
      hideIpToggle.dispatchEvent(new Event("change", { bubbles: true }));
      await expectErrorText(
        error,
        "Failed to save IP masking setting: write failed"
      );
      expect(hideIpToggle.checked).toBeFalsy();

      Object.defineProperty(hideIpAddressesItem, "setValue", {
        configurable: true,
        value: async () => {
          await Promise.resolve();
          throw nonErrorFailure;
        },
        writable: true,
      });
      Object.defineProperty(hideIpAddressesItem, "getValue", {
        configurable: true,
        value: async () => await Promise.reject(new Error("read failed")),
        writable: true,
      });

      hideIpToggle.checked = true;
      hideIpToggle.dispatchEvent(new Event("change", { bubbles: true }));
      await expectErrorText(
        error,
        "Failed to save IP masking setting: unknown error"
      );
      expect(hideIpToggle.checked).toBeFalsy();
    } finally {
      if (originalSetValue === undefined) {
        Reflect.deleteProperty(hideIpAddressesItem, "setValue");
      } else {
        Object.defineProperty(
          hideIpAddressesItem,
          "setValue",
          originalSetValue
        );
      }

      if (originalGetValue === undefined) {
        Reflect.deleteProperty(hideIpAddressesItem, "getValue");
      } else {
        Object.defineProperty(
          hideIpAddressesItem,
          "getValue",
          originalGetValue
        );
      }
    }
  });
});

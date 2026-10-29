import { describe, expect, it, vi } from "vitest";

import { hiddenEmailsItem } from "../src/lib/storage";
import type { StorageValue } from "./storage-test-helpers";
import {
  createDeferred,
  createWatchSource,
  createBooleanWatchSource,
  expectInputValue,
  expectListToContain,
  expectListNotToContain,
  expectLastApplied,
  expectErrorText,
} from "./storage-test-helpers";

describe("popup storage initialization", () => {
  it("popup applies a watcher update instead of a late snapshot", async () => {
    const elements = [
      Object.assign(document.createElement("input"), { id: "email-input" }),
      Object.assign(document.createElement("button"), { id: "add-btn" }),
      Object.assign(document.createElement("span"), { id: "error" }),
      Object.assign(document.createElement("ul"), { id: "email-list" }),
      Object.assign(document.createElement("input"), { id: "hide-ip-toggle" }),
    ];

    document.body.replaceChildren(...elements);

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

    const { initializePopupEmails, initializePopupIpMasking } =
      await import("../entrypoints/popup/popup");

    const applied: StorageValue[] = [];
    const initial = createDeferred<StorageValue>();
    const source = createWatchSource();

    const initialization = initializePopupEmails(
      async () => await initial.promise,
      source.subscribe,
      (value) => {
        applied.push(value);
      }
    );

    source.emit(["new@example.com"]);
    initial.resolve(["old@example.com"]);
    await initialization;

    expect(applied).toStrictEqual([["new@example.com"]]);

    const appliedIpSettings: (boolean | null | undefined)[] = [];
    const ipInitial = createDeferred<boolean | null | undefined>();
    const ipSource = createBooleanWatchSource();

    const ipInitialization = initializePopupIpMasking(
      async () => await ipInitial.promise,
      ipSource.subscribe,
      (value) => {
        appliedIpSettings.push(value);
      }
    );

    ipSource.emit(true);
    ipInitial.resolve(false);
    await ipInitialization;
    expect(appliedIpSettings).toStrictEqual([true]);

    const ipConsoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await initializePopupIpMasking(
      async () => await Promise.reject(new Error("read failed")),
      () => {},
      (value) => {
        appliedIpSettings.push(value);
      }
    );

    ipConsoleError.mockClear();
    const staleIpReadSource = createBooleanWatchSource();
    await initializePopupIpMasking(
      async () => {
        staleIpReadSource.emit(true);

        return await Promise.reject(new Error("stale read failed"));
      },
      staleIpReadSource.subscribe,
      (value) => {
        appliedIpSettings.push(value);
      }
    );

    expect(appliedIpSettings).toStrictEqual([true, false, true]);
    expect(ipConsoleError).not.toHaveBeenCalled();
    ipConsoleError.mockRestore();

    const [input, addButton, error, list] = elements;

    if (
      !(input instanceof HTMLInputElement) ||
      !(addButton instanceof HTMLButtonElement) ||
      !(error instanceof HTMLSpanElement) ||
      !(list instanceof HTMLUListElement)
    ) {
      throw new TypeError("Popup elements were not created correctly");
    }

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await initializePopupEmails(
      async () => await Promise.reject(new Error("read failed")),
      () => {},
      (value) => {
        applied.push(value);
      }
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to load emails:",
      expect.any(Error)
    );
    expectLastApplied(applied, []);

    const staleReadSource = createWatchSource();
    await initializePopupEmails(
      async () => {
        staleReadSource.emit(["current@example.com"]);

        await Promise.reject(new Error("stale read failed"));
      },
      staleReadSource.subscribe,
      (value) => {
        applied.push(value);
      }
    );
    expectLastApplied(applied, ["current@example.com"]);
    consoleError.mockRestore();

    input.value = "preserved@example.com";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await Promise.resolve();
    await expectInputValue(input, "preserved@example.com");

    input.value = "not-an-email";
    addButton.click();
    await expectErrorText(error, "Please enter a valid email address.");

    input.value = "  USER@example.com  ";
    addButton.click();
    await expectInputValue(input, "");
    expectListToContain(list, "user@example.com");

    list.querySelector("button")?.click();
    await expectListNotToContain(list, "user@example.com");

    const originalSetValue = Object.getOwnPropertyDescriptor(
      hiddenEmailsItem,
      "setValue"
    );

    const nonErrorFailure: unknown = Object.freeze({ reason: "write failed" });

    try {
      Object.defineProperty(hiddenEmailsItem, "setValue", {
        configurable: true,
        value: async () => await Promise.reject(new Error("write failed")),
        writable: true,
      });

      input.value = "failure@example.com";
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      await expectErrorText(error, "Failed to add email: write failed");

      Object.defineProperty(hiddenEmailsItem, "setValue", {
        configurable: true,
        value: async () => {
          await Promise.resolve();
          throw nonErrorFailure;
        },
        writable: true,
      });

      input.value = "unknown-failure@example.com";
      addButton.click();
      await expectErrorText(error, "Failed to add email: unknown error");

      if (originalSetValue === undefined) {
        Reflect.deleteProperty(hiddenEmailsItem, "setValue");
      } else {
        Object.defineProperty(hiddenEmailsItem, "setValue", originalSetValue);
      }

      input.value = "remove-failure@example.com";
      addButton.click();
      await expectInputValue(input, "");

      Object.defineProperty(hiddenEmailsItem, "setValue", {
        configurable: true,
        value: async () => {
          await Promise.resolve();
          throw new Error("remove failed");
        },
        writable: true,
      });
      list.querySelector("button")?.click();
      await expectErrorText(error, "Failed to remove email: remove failed");

      if (originalSetValue === undefined) {
        Reflect.deleteProperty(hiddenEmailsItem, "setValue");
      } else {
        Object.defineProperty(hiddenEmailsItem, "setValue", originalSetValue);
      }

      input.value = "remove-unknown@example.com";
      addButton.click();
      await expectInputValue(input, "");
      Object.defineProperty(hiddenEmailsItem, "setValue", {
        configurable: true,
        value: async () => {
          await Promise.resolve();
          throw nonErrorFailure;
        },
        writable: true,
      });
      const unknownRemoveButton = list.querySelectorAll("li button").item(1);

      if (!(unknownRemoveButton instanceof HTMLButtonElement)) {
        throw new TypeError("Expected the second email remove button");
      }

      unknownRemoveButton.click();
      await expectErrorText(error, "Failed to remove email: unknown error");

      if (originalSetValue === undefined) {
        Reflect.deleteProperty(hiddenEmailsItem, "setValue");
      } else {
        Object.defineProperty(hiddenEmailsItem, "setValue", originalSetValue);
      }

      list.querySelector("button")?.click();
      await expectListNotToContain(list, "remove-failure@example.com");
      list.querySelector("button")?.click();
      await expectListNotToContain(list, "remove-unknown@example.com");

      await initializePopupEmails(
        async () => await Promise.resolve(null),
        () => {},
        (value) => {
          applied.push(value);
        }
      );
    } finally {
      if (originalSetValue !== undefined) {
        Object.defineProperty(hiddenEmailsItem, "setValue", originalSetValue);
      }
    }

    input.value = "remove@example.com";
    addButton.click();
    await expectInputValue(input, "");
    list.querySelector("button")?.click();
    await expectListNotToContain(list, "remove@example.com");
  });
});

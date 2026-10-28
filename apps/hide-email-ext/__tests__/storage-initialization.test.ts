import { it, describe, expect, vi } from "vitest";

import {
  createContentEmailApplier,
  initializeContentEmails,
  initializeContentIpMasking,
  runContentScript,
} from "../entrypoints/content";
import { hiddenEmailsItem } from "../src/lib/storage";

type StorageValue = string[] | null | undefined;

type Watcher = (value: StorageValue) => void;

type BooleanWatcher = (value: boolean | null | undefined) => void;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

interface WatchSource {
  emit: (value: StorageValue) => void;
  subscribe: (watcher: Watcher) => void;
}

interface BooleanWatchSource {
  emit: (value: boolean | null | undefined) => void;
  subscribe: (watcher: BooleanWatcher) => void;
}

const createDeferred = <T>(): Deferred<T> => Promise.withResolvers<T>();

const createWatchSource = (): WatchSource => {
  let listener: Watcher | null = null;

  return {
    emit: (value) => listener?.(value),
    subscribe: (watcher) => {
      listener = watcher;
    },
  };
};

const createBooleanWatchSource = (): BooleanWatchSource => {
  let listener: BooleanWatcher | null = null;

  return {
    emit: (value) => listener?.(value),
    subscribe: (watcher) => {
      listener = watcher;
    },
  };
};

const expectInputValue = async (
  input: HTMLInputElement,
  value: string
): Promise<void> => {
  await vi.waitFor(() => {
    expect(input.value).toBe(value);
  });
};

const expectListToContain = (list: HTMLUListElement, value: string): void => {
  expect(list.textContent).toContain(value);
};

const expectListNotToContain = async (
  list: HTMLUListElement,
  value: string
): Promise<void> => {
  await vi.waitFor(() => {
    expect(list.textContent).not.toContain(value);
  });
};

const expectLastApplied = (
  applied: StorageValue[],
  expected: StorageValue
): void => {
  expect(applied.at(-1)).toStrictEqual(expected);
};

const expectErrorText = async (
  error: HTMLSpanElement,
  expected: string
): Promise<void> => {
  await vi.waitFor(() => {
    expect(error.textContent).toBe(expected);
  });
};

describe("storage initialization", () => {
  it("runs while either emails or IP masking is enabled", async () => {
    let emailListener: Watcher | undefined;
    let ipListener: BooleanWatcher | undefined;
    const actions: string[] = [];

    await runContentScript(
      {
        setEmails: (emails) => {
          actions.push(`emails:${emails.length}`);
        },
        setHideIpAddresses: (enabled) => {
          actions.push(`ip:${enabled}`);
        },
        start: () => {
          actions.push("start");
        },
        stop: () => {
          actions.push("stop");
        },
      },
      {
        getValue: async () => await Promise.resolve(["initial@example.com"]),
        watch: (listener) => {
          emailListener = listener;
        },
      },
      {
        getValue: async () => await Promise.resolve(false),
        watch: (listener) => {
          ipListener = listener;
        },
      }
    );

    expect(actions).toStrictEqual([
      "emails:1",
      "ip:false",
      "start",
      "emails:1",
      "ip:false",
    ]);

    ipListener?.(true);
    emailListener?.([]);
    expect(actions.slice(-4)).toStrictEqual([
      "emails:1",
      "ip:true",
      "emails:0",
      "ip:true",
    ]);

    ipListener?.(false);
    expect(actions.slice(-3)).toStrictEqual(["emails:0", "ip:false", "stop"]);
  });

  it("content applies a watcher update instead of a late IP setting snapshot", async () => {
    const initial = createDeferred<boolean | null | undefined>();
    const applied: (boolean | null | undefined)[] = [];
    const source = createBooleanWatchSource();

    const initialization = initializeContentIpMasking(
      async () => await initial.promise,
      source.subscribe,
      (value) => {
        applied.push(value);
      }
    );

    source.emit(true);
    initial.resolve(false);
    await initialization;

    expect(applied).toStrictEqual([true]);
  });

  it("content defaults IP masking to false when no stored value exists", async () => {
    const applied: (boolean | null | undefined)[] = [];

    await initializeContentIpMasking(
      async () => await Promise.resolve(null),
      () => {},
      (value) => {
        applied.push(value);
      }
    );

    expect(applied).toStrictEqual([false]);
  });

  it("content defaults IP masking to false when the initial read fails", async () => {
    const applied: (boolean | null | undefined)[] = [];

    await initializeContentIpMasking(
      async () => await Promise.reject(new Error("read failed")),
      () => {},
      (value) => {
        applied.push(value);
      }
    );

    expect(applied).toStrictEqual([false]);
  });

  it("content applies a watcher update instead of a late snapshot", async () => {
    const initial = createDeferred<StorageValue>();
    const applied: StorageValue[] = [];
    const source = createWatchSource();

    const initialization = initializeContentEmails(
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
  });

  it("content applies a nonempty initial snapshot when no update arrives", async () => {
    const applied: StorageValue[] = [];

    await initializeContentEmails(
      async () => await Promise.resolve(["initial@example.com"]),
      () => {},
      (value) => {
        applied.push(value);
      }
    );

    expect(applied).toStrictEqual([["initial@example.com"]]);
  });

  it("content applies empty state without requiring a watcher update", async () => {
    const applied: StorageValue[] = [];

    await initializeContentEmails(
      async () => await Promise.resolve([]),
      () => {},
      (value) => {
        applied.push(value);
      }
    );

    expect(applied).toStrictEqual([[]]);
  });

  it("content normalizes a missing initial value to an empty list", async () => {
    const applied: StorageValue[] = [];

    await initializeContentEmails(
      async () => await Promise.resolve(null),
      () => {},
      (value) => {
        applied.push(value);
      }
    );

    expect(applied).toStrictEqual([[]]);
  });

  it("content falls back to an empty list when the initial read fails", async () => {
    const applied: StorageValue[] = [];

    await initializeContentEmails(
      async () => await Promise.reject(new Error("read failed")),
      () => {},
      (value) => {
        applied.push(value);
      }
    );

    expect(applied).toStrictEqual([[]]);
  });

  it("content ignores a failed snapshot after receiving a watcher update", async () => {
    const applied: StorageValue[] = [];
    const source = createWatchSource();

    await initializeContentEmails(
      async () => {
        source.emit(["latest@example.com"]);

        await Promise.reject(new Error("stale read failed"));
      },
      source.subscribe,
      (value) => {
        applied.push(value);
      }
    );

    expect(applied).toStrictEqual([["latest@example.com"]]);
  });

  it("content does not start the redactor for an empty list", () => {
    const started: string[] = [];

    const apply = createContentEmailApplier({
      setEmails: () => {
        started.push("setEmails");
      },
      start: () => {
        started.push("start");
      },
      stop: () => {
        started.push("stop");
      },
    });

    apply([]);

    expect(started).toStrictEqual(["setEmails"]);
  });

  it("content starts for a nonempty initial list and stops when it empties", () => {
    const actions: string[] = [];

    const apply = createContentEmailApplier({
      setEmails: (emails) => {
        actions.push(`set:${emails.length}`);
      },
      start: () => {
        actions.push("start");
      },
      stop: () => {
        actions.push("stop");
      },
    });

    apply(["initial@example.com"]);
    apply(["another@example.com"]);
    apply(null);
    apply([]);

    expect(actions).toStrictEqual([
      "set:1",
      "start",
      "set:1",
      "set:0",
      "stop",
      "set:0",
    ]);
  });

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
    ipConsoleError.mockRestore();
    expect(appliedIpSettings).toStrictEqual([true, false]);

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

  it("popup rejects missing or incorrectly typed required elements", async () => {
    document.body.replaceChildren(
      Object.assign(document.createElement("div"), { id: "email-input" })
    );
    vi.resetModules();

    await expect(import("../entrypoints/popup/popup")).rejects.toThrow(
      "Element #email-input not found or wrong type"
    );
  });
});

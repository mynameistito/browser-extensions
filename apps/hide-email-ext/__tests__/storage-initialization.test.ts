import { it, describe, expect } from "vitest";

import {
  createContentEmailApplier,
  initializeContentEmails,
} from "../entrypoints/content";

type StorageValue = string[] | null | undefined;

type Watcher = (value: StorageValue) => void;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

interface WatchSource {
  emit: (value: StorageValue) => void;
  subscribe: (watcher: Watcher) => void;
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

describe("storage initialization", () => {
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
    apply([]);

    expect(actions).toStrictEqual(["set:1", "start", "set:0", "stop"]);
  });

  it("popup applies a watcher update instead of a late snapshot", async () => {
    const elements = [
      Object.assign(document.createElement("input"), { id: "email-input" }),
      Object.assign(document.createElement("button"), { id: "add-btn" }),
      Object.assign(document.createElement("span"), { id: "error" }),
      Object.assign(document.createElement("ul"), { id: "email-list" }),
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

    const { initializePopupEmails } =
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
  });
});

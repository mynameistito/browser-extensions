import { describe, expect, it } from "vitest";

import {
  createContentEmailApplier,
  initializeContentEmails,
  initializeContentIpMasking,
  runContentScript,
} from "../entrypoints/content";
import type {
  StorageValue,
  Watcher,
  BooleanWatcher,
} from "./storage-test-helpers";
import {
  createDeferred,
  createWatchSource,
  createBooleanWatchSource,
} from "./storage-test-helpers";

describe("content storage initialization", () => {
  it("uses the default redactor with injected content storage", async () => {
    await expect(
      runContentScript(
        undefined,
        {
          getValue: async () => await Promise.resolve([]),
          watch: () => {},
        },
        {
          getValue: async () => await Promise.resolve(false),
          watch: () => {},
        }
      )
    ).resolves.toBeUndefined();
  });

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
});

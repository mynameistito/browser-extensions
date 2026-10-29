import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_CLEANUP,
  loadCleanupSettings,
  runCleanupAction,
} from "../src/features/cleanup/cleanup-settings";
import { StorageReadError } from "../src/lib/errors/storage-read-error";
import type { Cleanup } from "../src/lib/schemas";

type StorageData =
  | boolean
  | null
  | number
  | string
  | readonly StorageData[]
  | { readonly [key: string]: StorageData };

interface RuntimeRequest {
  readonly payload: Record<string, never>;
  readonly type: "cleanup.runNow";
}

type RuntimeResponse =
  | { readonly ok: true; readonly value: { readonly lastRunAt: number } }
  | { readonly error: string; readonly ok: false };

interface BrowserState {
  readonly sentMessages: RuntimeRequest[];
  readonly storage: Map<string, StorageData>;
}

interface BrowserOptions {
  readonly get?: (
    key: string
  ) => Promise<Record<string, StorageData | undefined>>;
  readonly sendMessage?: (message: RuntimeRequest) => Promise<RuntimeResponse>;
  readonly set?: (values: Record<string, StorageData>) => Promise<void>;
  readonly storage?: Record<string, StorageData>;
}

const originalBrowser = Object.getOwnPropertyDescriptor(globalThis, "browser");

const installBrowser = (options: BrowserOptions = {}): BrowserState => {
  const state: BrowserState = {
    sentMessages: [],
    storage: new Map(Object.entries(options.storage ?? {})),
  };

  const mockBrowser = {
    runtime: {
      sendMessage: async (message: RuntimeRequest) => {
        state.sentMessages.push(message);

        return await (options.sendMessage?.(message) ??
          Promise.resolve({
            ok: true,
            value: { lastRunAt: 1_800_000_000_000 },
          }));
      },
    },
    storage: {
      local: {
        get: async (key: string) =>
          await (options.get?.(key) ??
            Promise.resolve({ [key]: state.storage.get(key) })),
        set: async (values: Record<string, StorageData>) => {
          await options.set?.(values);

          for (const [key, value] of Object.entries(values)) {
            state.storage.set(key, value);
          }
        },
      },
    },
  };

  Object.defineProperty(globalThis, "browser", {
    configurable: true,
    value: mockBrowser,
  });

  return state;
};

const cleanup = (overrides: Partial<Cleanup> = {}): Cleanup => ({
  ...DEFAULT_CLEANUP,
  ...overrides,
});

describe("cleanup settings lifecycle", () => {
  afterEach(() => {
    if (originalBrowser) {
      Object.defineProperty(globalThis, "browser", originalBrowser);
    } else {
      Reflect.deleteProperty(globalThis, "browser");
    }
  });

  it("loads schema defaults when cleanup settings are absent", async () => {
    installBrowser();

    await expect(loadCleanupSettings()).resolves.toStrictEqual({
      retention: "3m",
      schedule: "never",
      whitelistExempt: true,
    });
  });

  it("surfaces storage read failures through the loading interface", async () => {
    installBrowser({
      get: async () => {
        await Promise.resolve();

        throw new Error("storage unavailable");
      },
    });

    await expect(loadCleanupSettings()).rejects.toBeInstanceOf(
      StorageReadError
    );
  });

  it("persists saved settings before invalidating the cached value", async () => {
    const state = installBrowser();
    const events: string[] = [];
    const draft = cleanup({ schedule: "weekly", retention: "2w" });

    const result = await runCleanupAction("save", draft, async () => {
      events.push("invalidate");
      await Promise.resolve();
    });

    expect(result).toStrictEqual({
      kind: "success",
      message: "Cleanup settings saved.",
      saved: true,
    });
    expect(state.storage.get("cleanup")).toStrictEqual(draft);
    expect(events).toStrictEqual(["invalidate"]);
  });

  it("runs cleanup through extension messaging and invalidates settings", async () => {
    const state = installBrowser();
    const events: string[] = [];

    const result = await runCleanupAction("run-now", cleanup(), async () => {
      events.push("invalidate");
      await Promise.resolve();
    });

    expect(state.sentMessages).toStrictEqual([
      { payload: {}, type: "cleanup.runNow" },
    ]);
    expect(events).toStrictEqual(["invalidate"]);
    expect(result).toMatchObject({ kind: "success", saved: false });
    expect(result.message).toMatch(/^Cleanup finished at /u);
  });

  it("keeps storage failures as action errors and skips invalidation", async () => {
    installBrowser({
      set: async () => {
        await Promise.resolve();

        throw new Error("storage is read-only");
      },
    });
    let invalidated = false;

    const result = await runCleanupAction("save", cleanup(), async () => {
      invalidated = true;
      await Promise.resolve();
    });

    expect(result.kind).toBe("error");
    expect(invalidated).toBeFalsy();
  });

  it("reports cleanup messaging errors and skips invalidation", async () => {
    installBrowser({
      sendMessage: async () => {
        await Promise.resolve();

        return { ok: false, error: "cleanup failed" };
      },
    });
    let invalidated = false;

    const result = await runCleanupAction("run-now", cleanup(), async () => {
      invalidated = true;
      await Promise.resolve();
    });

    expect(result).toStrictEqual({ kind: "error", message: "cleanup failed" });
    expect(invalidated).toBeFalsy();
  });
});

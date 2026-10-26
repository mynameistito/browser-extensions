import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  enforceBlacklist,
  maybeRunScheduledCleanup,
  runConfiguredCleanup,
  runOnCloseCleanup,
} from "../src/background/enforcement";
import { BrowserApiError } from "../src/lib/errors/browser-api-error";
import type { Cleanup, DomainRule } from "../src/lib/schemas";

const NOW = 1_800_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

type StorageData =
  | boolean
  | null
  | number
  | string
  | readonly StorageData[]
  | { readonly [key: string]: StorageData };

interface BrowserMocks {
  deletedRanges: Browser.history.Range[];
  deletedUrls: string[];
  searchQueries: Browser.history.HistoryQuery[];
  searchResults: Browser.history.HistoryItem[];
  storage: Map<string, StorageData>;
}

interface BrowserApiMock {
  history: {
    deleteRange: (range: Browser.history.Range) => Promise<void>;
    deleteUrl: (details: Browser.history.UrlDetails) => Promise<void>;
    search: (
      query: Browser.history.HistoryQuery
    ) => Promise<Browser.history.HistoryItem[]>;
  };
  storage: {
    local: {
      get: (key: string) => Promise<Record<string, StorageData | undefined>>;
      set: (items: Record<string, StorageData>) => Promise<void>;
    };
  };
}

const originalBrowser = Object.getOwnPropertyDescriptor(globalThis, "browser");
const originalDateNow = Date.now;

const storageEntries = (
  ...entries: [string, StorageData][]
): Map<string, StorageData> => new Map<string, StorageData>(entries);

const installBrowserMocks = (
  initialStorage: Map<string, StorageData> = new Map<string, StorageData>(),
  searchResults: Browser.history.HistoryItem[] = []
): BrowserMocks => {
  const state: BrowserMocks = {
    deletedRanges: [],
    deletedUrls: [],
    searchQueries: [],
    searchResults,
    storage: new Map(initialStorage),
  };

  const mockBrowser = {
    history: {
      deleteRange: async (range: Browser.history.Range) => {
        state.deletedRanges.push(range);
        await Promise.resolve();
      },
      deleteUrl: async ({ url }: Browser.history.UrlDetails) => {
        state.deletedUrls.push(url);
        await Promise.resolve();
      },
      search: async (query: Browser.history.HistoryQuery) => {
        state.searchQueries.push(query);

        await Promise.resolve();

        return state.searchResults;
      },
    },
    storage: {
      local: {
        get: async (key: string) => {
          await Promise.resolve();

          return { [key]: state.storage.get(key) };
        },
        set: async (values: Record<string, StorageData>) => {
          for (const [key, value] of Object.entries(values)) {
            state.storage.set(key, value);
          }

          await Promise.resolve();
        },
      },
    },
  } satisfies BrowserApiMock;

  Object.defineProperty(globalThis, "browser", {
    configurable: true,
    value: mockBrowser,
  });

  return state;
};

const cleanup = (overrides: Partial<Cleanup> = {}): Cleanup => ({
  retention: "1w",
  schedule: "never",
  whitelistExempt: false,
  ...overrides,
});

const historyItem = (url: string): Browser.history.HistoryItem =>
  ({
    id: url,
    lastVisitTime: NOW,
    title: "",
    typedCount: 0,
    url,
    visitCount: 1,
  }) satisfies Browser.history.HistoryItem;

const getCleanupFailureApi = async (): Promise<string | null> => {
  try {
    await runConfiguredCleanup();

    return null;
  } catch (error) {
    if (!(error instanceof BrowserApiError)) {
      throw error;
    }

    return error.api;
  }
};

describe("history cleanup", () => {
  beforeEach(() => {
    Date.now = () => NOW;
  });

  afterEach(() => {
    Date.now = originalDateNow;

    if (originalBrowser) {
      Object.defineProperty(globalThis, "browser", originalBrowser);
    } else {
      Reflect.deleteProperty(globalThis, "browser");
    }
  });

  it("deletes the exact range ending at the retention cutoff", async () => {
    const mocks = installBrowserMocks(storageEntries(["cleanup", cleanup()]));

    await runConfiguredCleanup();

    expect(mocks.deletedRanges).toStrictEqual([
      { endTime: NOW - 7 * DAY_MS, startTime: 0 },
    ]);
  });

  it("preserves whitelist matches and deletes nonmatching URLs", async () => {
    const whitelist: DomainRule[] = [
      { kind: "subdomain", pattern: "keep.example" },
    ];

    const mocks = installBrowserMocks(
      storageEntries(
        ["cleanup", cleanup({ whitelistExempt: true })],
        ["whitelist", whitelist]
      ),
      [
        historyItem("https://keep.example/page"),
        historyItem("https://sub.keep.example/page"),
        historyItem("https://remove.example/page"),
      ]
    );

    await runConfiguredCleanup();

    expect(mocks.deletedUrls).toStrictEqual(["https://remove.example/page"]);
    expect(mocks.deletedRanges).toStrictEqual([]);
  });

  it("does not delete any visits for a URL with a recent visit", async () => {
    const mocks = installBrowserMocks(
      storageEntries(
        ["cleanup", cleanup({ whitelistExempt: true })],
        ["whitelist", [{ kind: "exact", pattern: "keep.example" }]]
      ),
      // history.search returns a URL when its most recent visit is in range;
      // deleteUrl is URL-wide and would remove both old and recent visits.
      [historyItem("https://keep.example/recently-visited")]
    );

    await runConfiguredCleanup();

    expect(mocks.searchQueries).toStrictEqual([
      {
        endTime: NOW - 7 * DAY_MS,
        maxResults: 100_000,
        startTime: 0,
        text: "",
      },
    ]);
    expect(mocks.deletedUrls).toStrictEqual([]);
  });

  it("applies whitelist precedence when enforcing blacklisted URLs", async () => {
    const blacklist: DomainRule[] = [
      { kind: "subdomain", pattern: "example.com" },
    ];

    const whitelist: DomainRule[] = [{ kind: "exact", pattern: "example.com" }];

    const mocks = installBrowserMocks(
      storageEntries(
        ["blacklist", blacklist],
        ["settings", { whitelistPrecedence: true }],
        ["whitelist", whitelist]
      ),
      [
        historyItem("https://example.com/"),
        historyItem("https://sub.example.com/"),
      ]
    );

    await enforceBlacklist();

    expect(mocks.deletedUrls).toStrictEqual(["https://sub.example.com/"]);
  });

  it("blacklist wins when whitelist precedence is disabled", async () => {
    const rules: DomainRule[] = [{ kind: "exact", pattern: "example.com" }];

    const mocks = installBrowserMocks(
      storageEntries(
        ["blacklist", rules],
        ["settings", { whitelistPrecedence: false }],
        ["whitelist", rules]
      ),
      [historyItem("https://example.com/")]
    );

    await enforceBlacklist();

    expect(mocks.deletedUrls).toStrictEqual(["https://example.com/"]);
  });

  it("scheduled cleanup does nothing for on-close schedules", async () => {
    const mocks = installBrowserMocks(
      storageEntries(["cleanup", cleanup({ schedule: "on-close" })])
    );

    await maybeRunScheduledCleanup();

    expect(mocks.deletedRanges).toStrictEqual([]);
    expect(mocks.storage.get("cleanup")).toStrictEqual(
      cleanup({ schedule: "on-close" })
    );
  });

  it("runs due scheduled cleanup and persists its completion time", async () => {
    const mocks = installBrowserMocks(
      storageEntries([
        "cleanup",
        cleanup({ schedule: "daily", lastRunAt: NOW - DAY_MS }),
      ])
    );

    await maybeRunScheduledCleanup();

    expect(mocks.deletedRanges).toStrictEqual([
      { endTime: NOW - 7 * DAY_MS, startTime: 0 },
    ]);
    expect(mocks.storage.get("cleanup")).toStrictEqual(
      cleanup({ schedule: "daily", lastRunAt: NOW })
    );
  });

  it("on-close cleanup does nothing for other schedules", async () => {
    const mocks = installBrowserMocks(
      storageEntries(["cleanup", cleanup({ schedule: "daily" })])
    );

    await runOnCloseCleanup();

    expect(mocks.deletedRanges).toStrictEqual([]);
    expect(mocks.storage.get("cleanup")).toStrictEqual(
      cleanup({ schedule: "daily" })
    );
  });

  it("surfaces browser API errors from range deletion", async () => {
    installBrowserMocks(storageEntries(["cleanup", cleanup()]));

    const failingBrowser = {
      history: {
        deleteRange: async () => {
          await Promise.resolve();
          throw new Error("history unavailable");
        },
        deleteUrl: async () => {
          await Promise.resolve();
        },
        search: async () => {
          await Promise.resolve();

          return [];
        },
      },
      storage: {
        local: {
          get: async () => {
            await Promise.resolve();

            return { cleanup: cleanup() };
          },
          set: async () => {
            await Promise.resolve();
          },
        },
      },
    } satisfies BrowserApiMock;

    Object.defineProperty(globalThis, "browser", {
      configurable: true,
      value: failingBrowser,
    });

    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      await expect(getCleanupFailureApi()).resolves.toBe("history.deleteRange");
    } finally {
      console.error = originalConsoleError;
    }
  });
});

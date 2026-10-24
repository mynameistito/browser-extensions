/// <reference types="bun" />
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { Result } from "better-result";

import {
  enforceBlacklist,
  maybeRunScheduledCleanup,
  runConfiguredCleanup,
  runOnCloseCleanup,
} from "../src/background/enforcement";
import { history } from "../src/lib/browser-api";
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

        return Promise.resolve();
      },
      deleteUrl: async ({ url }: Browser.history.UrlDetails) => {
        state.deletedUrls.push(url);

        return Promise.resolve();
      },
      search: async (query: Browser.history.HistoryQuery) => {
        state.searchQueries.push(query);

        return Promise.resolve(state.searchResults);
      },
    },
    storage: {
      local: {
        get: async (key: string) =>
          Promise.resolve({ [key]: state.storage.get(key) }),
        set: async (values: Record<string, StorageData>) => {
          for (const [key, value] of Object.entries(values)) {
            state.storage.set(key, value);
          }

          return Promise.resolve();
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

describe("history cleanup", () => {
  test("deletes the exact range ending at the retention cutoff", async () => {
    const mocks = installBrowserMocks(storageEntries(["cleanup", cleanup()]));

    await runConfiguredCleanup();

    expect(mocks.deletedRanges).toEqual([
      { endTime: NOW - 7 * DAY_MS, startTime: 0 },
    ]);
  });

  test("preserves whitelist matches and deletes nonmatching URLs", async () => {
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

    expect(mocks.deletedUrls).toEqual(["https://remove.example/page"]);
    expect(mocks.deletedRanges).toEqual([]);
  });

  test("does not delete any visits for a URL with a recent visit", async () => {
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

    expect(mocks.searchQueries).toEqual([
      {
        endTime: NOW - 7 * DAY_MS,
        maxResults: 100_000,
        startTime: 0,
        text: "",
      },
    ]);
    expect(mocks.deletedUrls).toEqual([]);
  });

  test("applies whitelist precedence when enforcing blacklisted URLs", async () => {
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

    expect(mocks.deletedUrls).toEqual(["https://sub.example.com/"]);
  });

  test("blacklist wins when whitelist precedence is disabled", async () => {
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

    expect(mocks.deletedUrls).toEqual(["https://example.com/"]);
  });

  test("scheduled cleanup does nothing for on-close schedules", async () => {
    const mocks = installBrowserMocks(
      storageEntries(["cleanup", cleanup({ schedule: "on-close" })])
    );

    await maybeRunScheduledCleanup();

    expect(mocks.deletedRanges).toEqual([]);
    expect(mocks.storage.get("cleanup")).toEqual(
      cleanup({ schedule: "on-close" })
    );
  });

  test("on-close cleanup does nothing for other schedules", async () => {
    const mocks = installBrowserMocks(
      storageEntries(["cleanup", cleanup({ schedule: "daily" })])
    );

    await runOnCloseCleanup();

    expect(mocks.deletedRanges).toEqual([]);
    expect(mocks.storage.get("cleanup")).toEqual(
      cleanup({ schedule: "daily" })
    );
  });

  test("surfaces browser API errors from range deletion", async () => {
    installBrowserMocks();

    const failingBrowser = {
      history: {
        deleteRange: async () =>
          Promise.reject(new Error("history unavailable")),
        deleteUrl: async () => Promise.resolve(),
        search: async () => Promise.resolve([]),
      },
      storage: {
        local: {
          get: async () => Promise.resolve({ cleanup: cleanup() }),
          set: async () => Promise.resolve(),
        },
      },
    } satisfies BrowserApiMock;

    Object.defineProperty(globalThis, "browser", {
      configurable: true,
      value: failingBrowser,
    });

    const result = await history.deleteRange({
      endTime: NOW - 7 * DAY_MS,
      startTime: 0,
    });

    expect(Result.isError(result)).toBe(true);

    if (Result.isError(result)) {
      expect(result.error.api).toBe("history.deleteRange");
    }
  });
});

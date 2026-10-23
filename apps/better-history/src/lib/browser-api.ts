import { Result } from "better-result";

import { BrowserApiError, PermissionDeniedError } from "@/lib/errors";

type Async<T> = Promise<Result<T, BrowserApiError>>;

type StorageValue =
  | boolean
  | null
  | number
  | string
  | readonly StorageValue[]
  | { readonly [key: string]: StorageValue };

const wrap = async <T>(api: string, fn: () => Promise<T>): Async<T> =>
  await Result.tryPromise({
    catch: (cause) => new BrowserApiError({ api, cause }),
    try: async () => await fn(),
  });

export const history = {
  deleteAll: async () =>
    await wrap("history.deleteAll", async () => {
      await browser.history.deleteAll();
    }),
  deleteRange: async (range: Browser.history.Range) =>
    await wrap("history.deleteRange", async () => {
      await browser.history.deleteRange(range);
    }),
  deleteUrl: async (details: Browser.history.UrlDetails) =>
    await wrap("history.deleteUrl", async () => {
      await browser.history.deleteUrl(details);
    }),
  getVisits: async (details: Browser.history.UrlDetails) =>
    await wrap(
      "history.getVisits",
      async () => await browser.history.getVisits(details)
    ),
  search: async (q: Browser.history.HistoryQuery) =>
    await wrap("history.search", async () => await browser.history.search(q)),
};

export const tabs = {
  create: async (props: Browser.tabs.CreateProperties) =>
    await wrap("tabs.create", async () => await browser.tabs.create(props)),
  query: async (q: Browser.tabs.QueryInfo) =>
    await wrap("tabs.query", async () => await browser.tabs.query(q)),
  remove: async (ids: number[]) =>
    await wrap("tabs.remove", async () => {
      await browser.tabs.remove(ids);
    }),
  update: async (
    id: number | undefined,
    props: Browser.tabs.UpdateProperties
  ) =>
    await wrap("tabs.update", async () => await browser.tabs.update(id, props)),
};

export const sessions = {
  getDevices: async () =>
    await wrap(
      "sessions.getDevices",
      async () => await browser.sessions.getDevices()
    ),
  getRecentlyClosed: async (filter?: Browser.sessions.Filter) =>
    await wrap(
      "sessions.getRecentlyClosed",
      async () => await browser.sessions.getRecentlyClosed(filter)
    ),
};

export const storageLocal = {
  clear: async () =>
    await wrap("storage.local.clear", async () => {
      await browser.storage.local.clear();
    }),
  get: async (keys?: string | string[] | null) =>
    await wrap(
      "storage.local.get",
      async () => await browser.storage.local.get(keys ?? null)
    ),
  remove: async (keys: string | string[]) =>
    await wrap("storage.local.remove", async () => {
      await browser.storage.local.remove(keys);
    }),
  set: async (items: Record<string, StorageValue>) =>
    await wrap("storage.local.set", async () => {
      await browser.storage.local.set(items);
    }),
};

export const alarms = {
  clear: async (name: string) =>
    await wrap("alarms.clear", async () => await browser.alarms.clear(name)),
  create: async (name: string, info: Browser.alarms.AlarmCreateInfo) =>
    await wrap("alarms.create", async () => {
      await Promise.resolve(browser.alarms.create(name, info));
    }),
};

export const contextMenus = {
  create: async (props: Browser.contextMenus.CreateProperties) =>
    await wrap("contextMenus.create", async () => {
      await Promise.resolve(browser.contextMenus.create(props));
    }),
  removeAll: async () =>
    await wrap("contextMenus.removeAll", async () => {
      await browser.contextMenus.removeAll();
    }),
};

export const permissions = {
  contains: async (perms: Browser.permissions.Permissions) =>
    await wrap(
      "permissions.contains",
      async () => await browser.permissions.contains(perms)
    ),
  remove: async (perms: Browser.permissions.Permissions) =>
    await wrap(
      "permissions.remove",
      async () => await browser.permissions.remove(perms)
    ),
  request: async (
    perms: Browser.permissions.Permissions
  ): Promise<Result<true, PermissionDeniedError | BrowserApiError>> => {
    const result = await wrap(
      "permissions.request",
      async () => await browser.permissions.request(perms)
    );

    if (Result.isError(result)) {
      return Result.err<true, PermissionDeniedError | BrowserApiError>(
        result.error
      );
    }

    if (!result.value) {
      return Result.err(
        new PermissionDeniedError({
          permissions: [...(perms.permissions ?? []), ...(perms.origins ?? [])],
        })
      );
    }

    return Result.ok(true as const);
  },
};

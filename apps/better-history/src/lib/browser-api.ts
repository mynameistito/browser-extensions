import { Result } from "better-result";
import { BrowserApiError, PermissionDeniedError } from "@/lib/errors";

type Async<T> = Promise<Result<T, BrowserApiError>>;

const wrap = <T>(api: string, fn: () => Promise<T>): Async<T> =>
  Result.tryPromise({
    try: fn,
    catch: (cause) => new BrowserApiError({ api, cause }),
  });

export const history = {
  search: (q: Browser.history.HistoryQuery) =>
    wrap("history.search", () => browser.history.search(q)),
  getVisits: (details: Browser.history.UrlDetails) =>
    wrap("history.getVisits", () => browser.history.getVisits(details)),
  deleteUrl: (details: Browser.history.UrlDetails) =>
    wrap("history.deleteUrl", () => browser.history.deleteUrl(details)),
  deleteRange: (range: Browser.history.Range) =>
    wrap("history.deleteRange", () => browser.history.deleteRange(range)),
  deleteAll: () => wrap("history.deleteAll", () => browser.history.deleteAll()),
};

export const tabs = {
  query: (q: Browser.tabs.QueryInfo) =>
    wrap("tabs.query", () => browser.tabs.query(q)),
  create: (props: Browser.tabs.CreateProperties) =>
    wrap("tabs.create", () => browser.tabs.create(props)),
  update: (id: number | undefined, props: Browser.tabs.UpdateProperties) =>
    wrap("tabs.update", () => browser.tabs.update(id, props)),
  remove: (ids: number | number[]) =>
    wrap("tabs.remove", () =>
      Array.isArray(ids) ? browser.tabs.remove(ids) : browser.tabs.remove(ids)
    ),
};

export const sessions = {
  getDevices: () =>
    wrap("sessions.getDevices", () => browser.sessions.getDevices()),
  getRecentlyClosed: (filter?: Browser.sessions.Filter) =>
    wrap("sessions.getRecentlyClosed", () =>
      browser.sessions.getRecentlyClosed(filter)
    ),
};

export const storageLocal = {
  get: <T = unknown>(keys?: string | string[] | null) =>
    wrap("storage.local.get", () =>
      browser.storage.local.get(keys ?? null)
    ) as Async<Record<string, T>>,
  set: (items: Record<string, unknown>) =>
    wrap("storage.local.set", () => browser.storage.local.set(items)),
  remove: (keys: string | string[]) =>
    wrap("storage.local.remove", () => browser.storage.local.remove(keys)),
  clear: () => wrap("storage.local.clear", () => browser.storage.local.clear()),
};

export const alarms = {
  create: (name: string, info: Browser.alarms.AlarmCreateInfo) =>
    wrap("alarms.create", () => {
      browser.alarms.create(name, info);
      return Promise.resolve();
    }),
  clear: (name: string) =>
    wrap("alarms.clear", () => browser.alarms.clear(name)),
};

export const contextMenus = {
  create: (props: Browser.contextMenus.CreateProperties) =>
    wrap("contextMenus.create", () => {
      browser.contextMenus.create(props);
      return Promise.resolve();
    }),
  removeAll: () =>
    wrap("contextMenus.removeAll", () => browser.contextMenus.removeAll()),
};

export const permissions = {
  contains: (perms: Browser.permissions.Permissions) =>
    wrap("permissions.contains", () => browser.permissions.contains(perms)),
  request: async (
    perms: Browser.permissions.Permissions
  ): Promise<Result<true, PermissionDeniedError | BrowserApiError>> => {
    const r = await wrap("permissions.request", () =>
      browser.permissions.request(perms)
    );
    if (Result.isError(r)) {
      return r;
    }
    if (!r.value) {
      return Result.err(
        new PermissionDeniedError({
          permissions: [...(perms.permissions ?? []), ...(perms.origins ?? [])],
        })
      );
    }
    return Result.ok(true as const);
  },
  remove: (perms: Browser.permissions.Permissions) =>
    wrap("permissions.remove", () => browser.permissions.remove(perms)),
};

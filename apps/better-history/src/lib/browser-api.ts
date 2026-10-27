import { Result } from "better-result";

import { BrowserApiError } from "./errors/browser-api-error";

type Async<T> = Promise<Result<T, BrowserApiError>>;

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

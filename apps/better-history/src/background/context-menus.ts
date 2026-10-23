import { Result } from "better-result";

import { contextMenus, history, tabs } from "@/lib/browser-api";
import { SettingsSchema } from "@/lib/schemas";
import { readKeyOr } from "@/lib/storage";

const MENU = {
  eraseSite: "bh.erase_site",
  removeUrl: "bh.remove_url",
  searchHistory: "bh.search_history",
  visitsDomain: "bh.visits_domain",
} as const;

const WWW_PREFIX = /^www\./u;

/** Rebuild the context menu entries from the user's settings. */
export const rebuildContextMenus = async (): Promise<void> => {
  await contextMenus.removeAll();

  const r = await readKeyOr("settings", SettingsSchema.parse({}));

  if (Result.isError(r)) {
    return;
  }

  const s = r.value;

  if (s.searchText) {
    await contextMenus.create({
      contexts: ["selection"],
      id: MENU.searchHistory,
      title: browser.i18n.getMessage("search_history"),
    });
  }

  if (s.searchDomain) {
    await contextMenus.create({
      contexts: ["page"],
      id: MENU.visitsDomain,
      title: browser.i18n.getMessage("visits_domain"),
    });
    await contextMenus.create({
      contexts: ["page"],
      id: MENU.eraseSite,
      title: browser.i18n.getMessage("eraseAllHistoryFromThisSite"),
    });
  }

  await contextMenus.create({
    contexts: ["page"],
    id: MENU.removeUrl,
    title: browser.i18n.getMessage("remove_url"),
  });
};

const hostOf = (url: string | undefined): string | null => {
  if (url === undefined || url.length === 0) {
    return null;
  }

  try {
    return new URL(url).host.toLowerCase().replace(WWW_PREFIX, "");
  } catch {
    return null;
  }
};

const handleSearchHistory = async (selectionText: string): Promise<void> => {
  const url = browser.runtime.getURL(
    `/history.html#/?q=${encodeURIComponent(selectionText)}`
  );

  await tabs.create({ url });
};

const handleVisitsDomain = async (
  pageUrl: string | undefined
): Promise<void> => {
  const host = hostOf(pageUrl);

  if (host === null) {
    return;
  }

  await tabs.create({
    url: browser.runtime.getURL(
      `/history.html#/?q=${encodeURIComponent(host)}`
    ),
  });
};

const handleEraseSite = async (pageUrl: string | undefined): Promise<void> => {
  const host = hostOf(pageUrl);

  if (host === null) {
    return;
  }

  const r = await history.search({
    maxResults: 10_000,
    startTime: 0,
    text: host,
  });

  if (Result.isError(r)) {
    return;
  }

  await Promise.all(
    r.value.flatMap((item) =>
      item.url !== undefined && hostOf(item.url) === host
        ? [history.deleteUrl({ url: item.url })]
        : []
    )
  );
};

/** Register handlers for the extension's context menu actions. */
export const registerContextMenuClicks = (): void => {
  browser.contextMenus.onClicked.addListener((info, tab) => {
    const id = String(info.menuItemId);
    const pageUrl = info.pageUrl ?? tab?.url;

    void (async () => {
      if (
        id === MENU.searchHistory &&
        info.selectionText !== undefined &&
        info.selectionText.length > 0
      ) {
        await handleSearchHistory(info.selectionText);
      } else if (id === MENU.visitsDomain) {
        await handleVisitsDomain(pageUrl);
      } else if (id === MENU.eraseSite) {
        await handleEraseSite(pageUrl);
      } else if (
        id === MENU.removeUrl &&
        pageUrl !== undefined &&
        pageUrl.length > 0
      ) {
        await history.deleteUrl({ url: pageUrl });
      }
    })();
  });
};

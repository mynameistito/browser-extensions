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

const t = (k: string) =>
  (browser.i18n.getMessage as (key: string) => string)(k) || k;

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
      title: t("search_history"),
    });
  }
  if (s.searchDomain) {
    await contextMenus.create({
      contexts: ["page"],
      id: MENU.visitsDomain,
      title: t("visits_domain"),
    });
    await contextMenus.create({
      contexts: ["page"],
      id: MENU.eraseSite,
      title: t("eraseAllHistoryFromThisSite"),
    });
  }
  await contextMenus.create({
    contexts: ["page"],
    id: MENU.removeUrl,
    title: t("remove_url"),
  });
};

const hostOf = (url: string | undefined): string | null => {
  if (!url) {
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
  if (!host) {
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
  if (!host) {
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
      item.url && hostOf(item.url) === host
        ? [history.deleteUrl({ url: item.url })]
        : []
    )
  );
};

export const registerContextMenuClicks = (): void => {
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    const id = String(info.menuItemId);
    const pageUrl = info.pageUrl ?? tab?.url;

    if (id === MENU.searchHistory && info.selectionText) {
      await handleSearchHistory(info.selectionText);
    } else if (id === MENU.visitsDomain) {
      await handleVisitsDomain(pageUrl);
    } else if (id === MENU.eraseSite) {
      await handleEraseSite(pageUrl);
    } else if (id === MENU.removeUrl && pageUrl) {
      await history.deleteUrl({ url: pageUrl });
    }
  });
};

import { Result } from "better-result";
import { contextMenus, history, tabs } from "@/lib/browser-api";
import { Settings } from "@/lib/schemas";
import { readKeyOr } from "@/lib/storage";

const MENU = {
  searchHistory: "bh.search_history",
  visitsDomain: "bh.visits_domain",
  eraseSite: "bh.erase_site",
  removeUrl: "bh.remove_url",
} as const;

const WWW_PREFIX = /^www\./;

const t = (k: string) =>
  (browser.i18n.getMessage as (key: string) => string)(k) || k;

export async function rebuildContextMenus() {
  await contextMenus.removeAll();

  const r = await readKeyOr("settings", Settings.parse({}));
  if (Result.isError(r)) {
    return;
  }
  const s = r.value;

  if (s.searchText) {
    await contextMenus.create({
      id: MENU.searchHistory,
      title: t("search_history"),
      contexts: ["selection"],
    });
  }
  if (s.searchDomain) {
    await contextMenus.create({
      id: MENU.visitsDomain,
      title: t("visits_domain"),
      contexts: ["page"],
    });
    await contextMenus.create({
      id: MENU.eraseSite,
      title: t("eraseAllHistoryFromThisSite"),
      contexts: ["page"],
    });
  }
  await contextMenus.create({
    id: MENU.removeUrl,
    title: t("remove_url"),
    contexts: ["page"],
  });
}

function hostOf(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).host.toLowerCase().replace(WWW_PREFIX, "");
  } catch {
    return null;
  }
}

async function handleSearchHistory(selectionText: string) {
  const url = browser.runtime.getURL(
    `/history.html#/?q=${encodeURIComponent(selectionText)}`
  );
  await tabs.create({ url });
}

async function handleVisitsDomain(pageUrl: string | undefined) {
  const host = hostOf(pageUrl);
  if (!host) {
    return;
  }
  await tabs.create({
    url: browser.runtime.getURL(`/history.html#/domain/${host}`),
  });
}

async function handleEraseSite(pageUrl: string | undefined) {
  const host = hostOf(pageUrl);
  if (!host) {
    return;
  }
  const r = await history.search({
    text: host,
    maxResults: 10_000,
    startTime: 0,
  });
  if (Result.isError(r)) {
    return;
  }
  for (const item of r.value) {
    if (item.url && hostOf(item.url) === host) {
      await history.deleteUrl({ url: item.url });
    }
  }
}

export function registerContextMenuClicks() {
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
}

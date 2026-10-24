import {
  STORAGE_KEY_DARK_MODE,
  STORAGE_KEY_MUTED_TABS,
} from "@/utils/constants.ts";

export type MutedTabsMap = Record<number, boolean>;

// Serialize all read-modify-write operations on STORAGE_KEY_MUTED_TABS to
// prevent concurrent calls from dropping each other's updates.
let storageLock: Promise<void> = Promise.resolve();

export const withStorageLock = (fn: () => Promise<void>): Promise<void> => {
  const runAfterLock = async () => {
    try {
      await storageLock;
    } finally {
      await fn();
    }
  };

  const next = runAfterLock();
  storageLock = (async () => {
    try {
      await next;
    } catch {
      // Keep future storage operations from being blocked by a failed one.
    }
  })();

  return next;
};

export const getMutedTabs = async (): Promise<MutedTabsMap> => {
  const result = await chrome.storage.session.get(STORAGE_KEY_MUTED_TABS);
  const raw = result[STORAGE_KEY_MUTED_TABS];
  return typeof raw === "object" && raw !== null ? (raw as MutedTabsMap) : {};
};

export const setTabMuted = (tabId: number, muted: boolean): Promise<void> =>
  withStorageLock(async () => {
    const mutedTabs = await getMutedTabs();
    mutedTabs[tabId] = muted;
    await chrome.storage.session.set({ [STORAGE_KEY_MUTED_TABS]: mutedTabs });
  });

export const removeTabFromStorage = (tabId: number): Promise<void> =>
  withStorageLock(async () => {
    const mutedTabs = await getMutedTabs();
    const { [tabId]: _removed, ...remainingMutedTabs } = mutedTabs;
    await chrome.storage.session.set({
      [STORAGE_KEY_MUTED_TABS]: remainingMutedTabs,
    });
  });

export const isTabMuted = async (tabId: number): Promise<boolean> => {
  const mutedTabs = await getMutedTabs();
  return mutedTabs[tabId] === true;
};

export const getIsDarkMode = async (): Promise<boolean> => {
  const result = await chrome.storage.session.get(STORAGE_KEY_DARK_MODE);
  return result[STORAGE_KEY_DARK_MODE] === true;
};

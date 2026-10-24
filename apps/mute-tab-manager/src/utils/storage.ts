import {
  STORAGE_KEY_DARK_MODE,
  STORAGE_KEY_MUTED_TABS,
} from "@/utils/constants.ts";

/** Map of tab IDs to their persisted muted state. */
export type MutedTabsMap = Record<number, boolean>;

// Serialize all read-modify-write operations on STORAGE_KEY_MUTED_TABS to
// prevent concurrent calls from dropping each other's updates.
let storageLock: Promise<void> = Promise.resolve();

/**
 * Runs a storage mutation after any earlier mutation has completed.
 *
 * @param fn - The serialized storage mutation.
 * @returns A promise that settles when the mutation completes.
 */
export const withStorageLock = async (
  fn: () => Promise<void>
): Promise<void> => {
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

  await next;
};

/**
 * Reads the saved muted state for all tabs.
 *
 * @returns The stored tab mute states, or an empty map if storage has no valid map.
 */
export const getMutedTabs = async (): Promise<MutedTabsMap> => {
  const result = await chrome.storage.session.get(STORAGE_KEY_MUTED_TABS);
  const raw = result[STORAGE_KEY_MUTED_TABS];

  if (!(raw instanceof Object) || Array.isArray(raw)) {
    return {};
  }

  const entries = Object.entries(raw);

  if (!entries.every(([, muted]) => muted === true || muted === false)) {
    return {};
  }

  const mutedTabs: MutedTabsMap = {};

  for (const [tabId, muted] of entries) {
    mutedTabs[Number(tabId)] = muted === true;
  }

  return mutedTabs;
};

/**
 * Saves whether a tab is muted while serializing concurrent storage updates.
 *
 * @param tabId - The browser tab ID.
 * @param muted - Whether the tab is muted.
 * @returns A promise that settles when the state is persisted.
 */
export const setTabMuted = async (
  tabId: number,
  muted: boolean
): Promise<void> => {
  await withStorageLock(async () => {
    const mutedTabs = await getMutedTabs();
    mutedTabs[tabId] = muted;
    await chrome.storage.session.set({ [STORAGE_KEY_MUTED_TABS]: mutedTabs });
  });
};

/**
 * Removes a closed tab from the persisted mute-state map.
 *
 * @param tabId - The closed browser tab ID.
 * @returns A promise that settles when the updated map is persisted.
 */
export const removeTabFromStorage = async (tabId: number): Promise<void> => {
  await withStorageLock(async () => {
    const mutedTabs = await getMutedTabs();

    const remainingMutedTabs = Object.fromEntries(
      Object.entries(mutedTabs).filter(
        ([storedTabId]) => Number(storedTabId) !== tabId
      )
    );

    await chrome.storage.session.set({
      [STORAGE_KEY_MUTED_TABS]: remainingMutedTabs,
    });
  });
};

/**
 * Reports whether a tab is currently marked as muted in session storage.
 *
 * @param tabId - The browser tab ID.
 * @returns Whether the tab is muted.
 */
export const isTabMuted = async (tabId: number): Promise<boolean> => {
  const mutedTabs = await getMutedTabs();

  return mutedTabs[tabId] === true;
};

/**
 * Reads the cached system dark-mode preference.
 *
 * @returns Whether dark mode is enabled.
 */
export const getIsDarkMode = async (): Promise<boolean> => {
  const result = await chrome.storage.session.get(STORAGE_KEY_DARK_MODE);

  return result[STORAGE_KEY_DARK_MODE] === true;
};

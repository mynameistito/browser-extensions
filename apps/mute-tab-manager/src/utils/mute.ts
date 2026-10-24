import { updateBadgeAndIcon } from "@/utils/badge.ts";
import { STORAGE_KEY_MUTED_TABS } from "@/utils/constants.ts";
import { getMutedTabs, setTabMuted, withStorageLock } from "@/utils/storage.ts";

/**
 * Sends the mute state to a tab's content script when available.
 *
 * @param tabId - The browser tab ID.
 * @param muted - Whether the content script should mute its media.
 * @returns A promise that settles after the message attempt.
 */
export const sendMuteToContentScript = async (
  tabId: number,
  muted: boolean
): Promise<void> => {
  try {
    await chrome.tabs.sendMessage(tabId, { muted, type: "SET_MUTED" });
  } catch {
    // Content script not available on this tab (non-YouTube); silently ignore
  }
};

/**
 * Toggles the browser's muted state for one tab and updates its UI.
 *
 * @param tabId - The browser tab ID.
 * @returns A promise that settles after state and UI updates.
 */
export const toggleMuteTab = async (tabId: number): Promise<void> => {
  const tab = await chrome.tabs.get(tabId);
  const currentlyMuted = tab.mutedInfo?.muted ?? false;
  const newMuted = !currentlyMuted;

  await chrome.tabs.update(tabId, { muted: newMuted });
  await sendMuteToContentScript(tabId, newMuted);
  await setTabMuted(tabId, newMuted);
  await updateBadgeAndIcon(tabId, newMuted);
};

/** Toggles mute for the active tab, if one is available. */
export const toggleMuteActiveTab = async (): Promise<void> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab?.id !== undefined && tab.id !== null) {
    await toggleMuteTab(tab.id);
  }
};

/** Mutes every tab that can be updated and persists successful changes. */
export const muteAllTabs = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({});

  const validTabs = tabs.filter(
    (tab): tab is chrome.tabs.Tab & { id: number } =>
      tab.id !== undefined && tab.id !== null
  );

  const results = await Promise.allSettled(
    validTabs.map(
      async (tab) => await chrome.tabs.update(tab.id, { muted: true })
    )
  );

  const succeededTabIds = results
    .map((result, i) => ({ originalIndex: i, result }))
    .filter(
      (
        item
      ): item is {
        result: PromiseFulfilledResult<chrome.tabs.Tab>;
        originalIndex: number;
      } =>
        item.result.status === "fulfilled" &&
        item.result.value !== undefined &&
        item.result.value !== null
    )
    .map(({ originalIndex }) => validTabs[originalIndex]?.id)
    .filter((id): id is number => id !== undefined);

  await Promise.allSettled(
    succeededTabIds.map(async (tabId) => {
      await sendMuteToContentScript(tabId, true);
      await updateBadgeAndIcon(tabId, true);
    })
  );

  await withStorageLock(async () => {
    const mutedTabs = await getMutedTabs();

    for (const tabId of succeededTabIds) {
      mutedTabs[tabId] = true;
    }

    await chrome.storage.session.set({ [STORAGE_KEY_MUTED_TABS]: mutedTabs });
  });
};

import type { Settings } from "@/lib/defaults";
import { DEFAULTS } from "@/lib/defaults";

export { DEFAULTS } from "@/lib/defaults";

export type { Settings } from "@/lib/defaults";

/**
 * Load every video control setting, falling back to its default value.
 * @returns The settings stored by the extension.
 */
export const loadSettings = async (): Promise<Settings> =>
  await browser.storage.local.get<Settings>(DEFAULTS);

/**
 * Persist a partial update to the user's video control settings.
 * @param patch - Settings fields to update.
 * @param patch - Settings fields to update.
 */
export const saveSettings = async (patch: Partial<Settings>): Promise<void> => {
  await browser.storage.local.set(patch);
};

/**
 * Best-effort settings persistence for synchronous UI event handlers.
 * Storage failures (for example an invalidated extension context after an
 * update) must not break event handling; the next change retries the save.
 * @param patch - Settings fields to persist.
 */
export const persistSettings = (patch: Partial<Settings>): void => {
  void (async () => {
    try {
      await saveSettings(patch);
    } catch {
      // Ignore: persistence is best-effort from event handlers.
    }
  })();
};

const SETTINGS_KEYS = [
  "playbackRate",
  "playbackRateAdjustmentStepSize",
  "rememberPlaybackRate",
  "rememberVolumeLevel",
  "volumeAdjustmentStepSize",
  "volumeLevel",
];

const isRelevantChange = (
  changes: Record<string, Browser.storage.StorageChange>
): boolean => SETTINGS_KEYS.some((key) => Object.hasOwn(changes, key));

const subscribers = new Set<(settings: Settings) => void>();

const handleSettingsChange = async (
  changes: Record<string, Browser.storage.StorageChange>
): Promise<void> => {
  if (!isRelevantChange(changes)) {
    return;
  }

  let settings: Settings;

  try {
    settings = await loadSettings();
  } catch {
    console.error("Could not reload settings after a storage change.");

    return;
  }

  for (const handler of subscribers) {
    handler(settings);
  }
};

const listener = (
  changes: Record<string, Browser.storage.StorageChange>
): void => {
  void handleSettingsChange(changes);
};

let listenerActive = false;

const ensureListener = () => {
  if (listenerActive) {
    return;
  }

  browser.storage.onChanged.addListener(listener);
  listenerActive = true;
};

/**
 * Subscribe to updates from extension storage.
 * @param handler - Function called with the latest settings.
 * @returns A function that removes the subscription.
 */
export const subscribeToSettings = (
  handler: (settings: Settings) => void
): (() => void) => {
  subscribers.add(handler);
  ensureListener();

  return () => {
    subscribers.delete(handler);

    if (subscribers.size === 0) {
      browser.storage.onChanged.removeListener(listener);
      listenerActive = false;
    }
  };
};

import type { Settings } from "@/lib/defaults";
import { DEFAULTS } from "@/lib/defaults";

export type { Settings };
export { DEFAULTS };

const DEFAULTS_AS_RECORD = DEFAULTS as unknown as Record<string, unknown>;

export const loadSettings = async (): Promise<Settings> => {
  const raw = await browser.storage.local.get(DEFAULTS_AS_RECORD);
  const fixed = { ...raw };

  for (const key of [
    "volumeLevel",
    "playbackRate",
    "volumeAdjustmentStepSize",
    "playbackRateAdjustmentStepSize",
  ] as const) {
    if (typeof fixed[key] === "string") {
      fixed[key] = Number(fixed[key]);
    }
  }

  return fixed as unknown as Settings;
};

export const saveSettings = async (patch: Partial<Settings>): Promise<void> => {
  await browser.storage.local.set(patch);
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
  changes: Record<string, { newValue?: unknown; oldValue?: unknown }>
): boolean => SETTINGS_KEYS.some((k) => k in changes);

const subscribers = new Set<(settings: Settings) => void>();

const listener = async (
  changes: Record<string, { newValue?: unknown; oldValue?: unknown }>
) => {
  if (!isRelevantChange(changes)) {
    return;
  }
  const settings = await loadSettings();
  for (const handler of subscribers) {
    handler(settings);
  }
};

let listenerActive = false;

const ensureListener = () => {
  if (listenerActive) {
    return;
  }
  browser.storage.onChanged.addListener(listener);
  listenerActive = true;
};

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

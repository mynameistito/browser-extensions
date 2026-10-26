import { defineBackground } from "#imports";
import { DEFAULTS } from "@/lib/defaults";

/** Initializes missing local settings with their defaults.
 * @returns A promise that resolves after settings are initialized.
 */
/** Initialize persisted settings with defaults while preserving stored values. */
export const initializeSettings = async (): Promise<void> => {
  const current = await browser.storage.local.get(Object.keys(DEFAULTS));
  await browser.storage.local.set({ ...DEFAULTS, ...current });
};

/** Registers the extension background initialization handler.
 * @returns Nothing.
 */
export default defineBackground(() => {
  void initializeSettings();
});

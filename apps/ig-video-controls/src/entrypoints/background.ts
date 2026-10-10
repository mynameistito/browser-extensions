import { defineBackground } from "#imports";
import { DEFAULTS } from "@/lib/defaults";

const DEFAULTS_AS_RECORD = DEFAULTS as unknown as Record<string, unknown>;

export default defineBackground(async () => {
  const current = await browser.storage.local.get(DEFAULTS_AS_RECORD);
  await browser.storage.local.set({ ...DEFAULTS, ...current });
});

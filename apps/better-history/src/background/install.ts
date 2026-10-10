import { Result } from "better-result";

import { CleanupSchema, MetaSchema, SettingsSchema } from "@/lib/schemas";
import { readKeyOr, writeKey } from "@/lib/storage";

export const seedDefaults = async (): Promise<void> => {
  const meta = await readKeyOr("meta", MetaSchema.parse({}));
  if (Result.isError(meta)) {
    console.error("seedDefaults: meta read failed", meta.error);
    return;
  }
  if (!meta.value.firstInit) {
    await writeKey("meta", {
      ...meta.value,
      firstInit: false,
      installedVersion: browser.runtime.getManifest().version,
      lastReloadTime: Date.now(),
    });
    return;
  }

  await writeKey("settings", SettingsSchema.parse({}));
  await writeKey("cleanup", CleanupSchema.parse({}));
  await writeKey("blacklist", []);
  await writeKey("whitelist", []);
  await writeKey("tracking", {});
  await writeKey("meta", {
    firstInit: false,
    installedVersion: browser.runtime.getManifest().version,
    lastReloadTime: Date.now(),
    wasRunning: false,
  });
};

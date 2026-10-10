import { Result } from "better-result";

import { CleanupSchema, MetaSchema, SettingsSchema } from "@/lib/schemas";
import type { StorageKey, StorageValue } from "@/lib/schemas";
import { readKey, readKeyOr, writeKey } from "@/lib/storage";

const seedKey = async <K extends StorageKey>(
  key: K,
  fallback: StorageValue<K>
): Promise<void> => {
  const current = await readKey(key);
  if (Result.isError(current)) {
    console.error(`seedDefaults: ${key} read failed`, current.error);
    return;
  }
  if (current.value !== undefined) {
    return;
  }
  const written = await writeKey(key, fallback);
  if (Result.isError(written)) {
    console.error(`seedDefaults: ${key} seed failed`, written.error);
  }
};

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

  await seedKey("settings", SettingsSchema.parse({}));
  await seedKey("cleanup", CleanupSchema.parse({}));
  await seedKey("blacklist", []);
  await seedKey("whitelist", []);
  await seedKey("tracking", {});
  await writeKey("meta", {
    firstInit: false,
    installedVersion: browser.runtime.getManifest().version,
    lastReloadTime: Date.now(),
    wasRunning: false,
  });
};

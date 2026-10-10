import { Result } from "better-result";
import { Cleanup, Meta, Settings } from "@/lib/schemas";
import { readKeyOr, writeKey } from "@/lib/storage";

export async function seedDefaults() {
  const meta = await readKeyOr("meta", Meta.parse({}));
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

  await writeKey("settings", Settings.parse({}));
  await writeKey("cleanup", Cleanup.parse({}));
  await writeKey("blacklist", []);
  await writeKey("whitelist", []);
  await writeKey("tracking", {});
  await writeKey("meta", {
    firstInit: false,
    installedVersion: browser.runtime.getManifest().version,
    lastReloadTime: Date.now(),
    wasRunning: false,
  });
}

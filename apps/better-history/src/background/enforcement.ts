import { Result } from "better-result";

import { history } from "@/lib/browser-api";
import type {
  BrowserApiError,
  StorageReadError,
  StorageValidationError,
} from "@/lib/errors";
import { extensionMessaging } from "@/lib/messages";
import { shouldDelete } from "@/lib/patterns";
import type { Cleanup } from "@/lib/schemas";
import { CleanupSchema, SettingsSchema } from "@/lib/schemas";
import { readKeyOr, writeKey } from "@/lib/storage";

const ALARM_NAME = "bh.enforce";
const PERIOD_MIN = 5;

const RETENTION_MS: Record<string, number> = {
  "1m": 30 * 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "2w": 14 * 24 * 60 * 60 * 1000,
  "3m": 90 * 24 * 60 * 60 * 1000,
};

type CleanupError = BrowserApiError | StorageReadError | StorageValidationError;

const runCleanup = async (
  retention: keyof typeof RETENTION_MS,
  whitelistExempt: boolean
): Promise<Result<null, CleanupError>> => {
  const ms = RETENTION_MS[retention];
  if (ms === undefined) {
    return Result.ok(null);
  }
  const cutoff = Date.now() - ms;
  if (!whitelistExempt) {
    const removed = await history.deleteRange({
      endTime: cutoff,
      startTime: 0,
    });
    if (Result.isError(removed)) {
      return Result.err<null, CleanupError>(removed.error);
    }
    return Result.ok(null);
  }

  const wl = await readKeyOr("whitelist", []);
  if (Result.isError(wl)) {
    return Result.err<null, CleanupError>(wl.error);
  }
  if (wl.value.length === 0) {
    const removed = await history.deleteRange({
      endTime: cutoff,
      startTime: 0,
    });
    if (Result.isError(removed)) {
      return Result.err<null, CleanupError>(removed.error);
    }
    return Result.ok(null);
  }

  // Search filters by each URL's most recent visit; deleteUrl removes every
  // visit for a URL, so recent activity must keep the entire URL intact.
  const r = await history.search({
    endTime: cutoff,
    maxResults: 100_000,
    startTime: 0,
    text: "",
  });
  if (Result.isError(r)) {
    return Result.err<null, CleanupError>(r.error);
  }
  const { anyRuleMatches } = await import("@/lib/patterns");
  const deletions = await Promise.all(
    r.value.flatMap((item) =>
      item.url && !anyRuleMatches(wl.value, item.url)
        ? [history.deleteUrl({ url: item.url })]
        : []
    )
  );
  for (const deletion of deletions) {
    if (Result.isError(deletion)) {
      return Result.err<null, CleanupError>(deletion.error);
    }
  }
  return Result.ok(null);
};

const runCleanupWithConfig = async (
  cfg: Cleanup,
  now = Date.now()
): Promise<number> => {
  const cleaned = await runCleanup(cfg.retention, cfg.whitelistExempt);
  if (Result.isError(cleaned)) {
    console.error("[enforcement] cleanup failed", cleaned.error);
    throw cleaned.error;
  }
  const written = await writeKey("cleanup", { ...cfg, lastRunAt: now });
  if (Result.isError(written)) {
    console.error(
      "[enforcement] failed to persist cleanup.lastRunAt",
      written.error
    );
    throw written.error;
  }
  return now;
};

const enforceBlacklist = async (): Promise<void> => {
  const [bl, wl, settings] = await Promise.all([
    readKeyOr("blacklist", []),
    readKeyOr("whitelist", []),
    readKeyOr("settings", SettingsSchema.parse({})),
  ]);
  if (Result.isError(bl) || Result.isError(wl) || Result.isError(settings)) {
    return;
  }
  if (bl.value.length === 0) {
    return;
  }

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const r = await history.search({
    maxResults: 10_000,
    startTime: since,
    text: "",
  });
  if (Result.isError(r)) {
    return;
  }

  await Promise.all(
    r.value.flatMap((item) =>
      item.url &&
      shouldDelete(
        item.url,
        bl.value,
        wl.value,
        settings.value.whitelistPrecedence
      )
        ? [history.deleteUrl({ url: item.url })]
        : []
    )
  );
};

const maybeRunScheduledCleanup = async (): Promise<void> => {
  const c = await readKeyOr("cleanup", CleanupSchema.parse({}));
  if (Result.isError(c)) {
    return;
  }
  const cfg = c.value;
  if (cfg.schedule === "never" || cfg.schedule === "on-close") {
    return;
  }

  const now = Date.now();
  const last = cfg.lastRunAt ?? 0;
  const DAY_MS = 24 * 60 * 60 * 1000;
  let interval: number;
  if (cfg.schedule === "daily") {
    interval = DAY_MS;
  } else if (cfg.schedule === "weekly") {
    interval = 7 * DAY_MS;
  } else {
    interval = 30 * DAY_MS;
  }
  if (now - last < interval) {
    return;
  }

  try {
    await runCleanupWithConfig(cfg, now);
  } catch (error) {
    console.error(
      "[enforcement] runCleanupWithConfig failed during alarm tick",
      { now, retention: cfg.retention, schedule: cfg.schedule },
      error
    );
  }
};

const tick = async (): Promise<void> => {
  await Promise.all([enforceBlacklist(), maybeRunScheduledCleanup()]);
};

export const ensureAlarm = async (): Promise<void> => {
  const existing = await browser.alarms.get(ALARM_NAME);
  if (existing) {
    return;
  }
  browser.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: PERIOD_MIN,
  });
};

export const registerAlarmHandler = (): void => {
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) {
      return;
    }
    await tick();
  });
};

export const runConfiguredCleanup = async (): Promise<{
  lastRunAt: number;
}> => {
  const c = await readKeyOr("cleanup", CleanupSchema.parse({}));
  if (Result.isError(c)) {
    throw c.error;
  }
  const lastRunAt = await runCleanupWithConfig(c.value);
  return { lastRunAt };
};

export const runOnCloseCleanup = async (): Promise<void> => {
  const c = await readKeyOr("cleanup", CleanupSchema.parse({}));
  if (Result.isError(c)) {
    return;
  }
  if (c.value.schedule !== "on-close") {
    return;
  }
  try {
    await runCleanupWithConfig(c.value);
  } catch (error) {
    console.error("[enforcement] runOnCloseCleanup failed", error);
  }
};

export const registerCleanupMessages = (): void => {
  extensionMessaging.onMessage("cleanup.runNow", () => runConfiguredCleanup());
};

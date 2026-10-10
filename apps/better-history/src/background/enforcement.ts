import { Result } from "better-result";
import { history } from "@/lib/browser-api";
import { extensionMessaging } from "@/lib/messages";
import { shouldDelete } from "@/lib/patterns";
import { Cleanup, Settings } from "@/lib/schemas";
import { readKeyOr, writeKey } from "@/lib/storage";

const ALARM_NAME = "bh.enforce";
const PERIOD_MIN = 5;

const RETENTION_MS: Record<string, number> = {
  "1w": 7 * 24 * 60 * 60 * 1000,
  "2w": 14 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
  "3m": 90 * 24 * 60 * 60 * 1000,
};

export async function ensureAlarm() {
  const existing = await browser.alarms.get(ALARM_NAME);
  if (existing) {
    return;
  }
  browser.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: PERIOD_MIN,
  });
}

export function registerAlarmHandler() {
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) {
      return;
    }
    await tick();
  });
}

async function tick() {
  await Promise.all([enforceBlacklist(), maybeRunScheduledCleanup()]);
}

async function enforceBlacklist() {
  const [bl, wl, settings] = await Promise.all([
    readKeyOr("blacklist", []),
    readKeyOr("whitelist", []),
    readKeyOr("settings", Settings.parse({})),
  ]);
  if (Result.isError(bl) || Result.isError(wl) || Result.isError(settings)) {
    return;
  }
  if (bl.value.length === 0) {
    return;
  }

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const r = await history.search({
    text: "",
    maxResults: 10_000,
    startTime: since,
  });
  if (Result.isError(r)) {
    return;
  }

  for (const item of r.value) {
    if (!item.url) {
      continue;
    }
    if (
      shouldDelete(
        item.url,
        bl.value,
        wl.value,
        settings.value.whitelistPrecedence
      )
    ) {
      await history.deleteUrl({ url: item.url });
    }
  }
}

async function maybeRunScheduledCleanup() {
  const c = await readKeyOr("cleanup", Cleanup.parse({}));
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
  } catch (err) {
    console.error(
      "[enforcement] runCleanupWithConfig failed during alarm tick",
      { now, schedule: cfg.schedule, retention: cfg.retention },
      err
    );
  }
}

async function runCleanupWithConfig(cfg: Cleanup, now = Date.now()) {
  await runCleanup(cfg.retention, cfg.whitelistExempt);
  const written = await writeKey("cleanup", { ...cfg, lastRunAt: now });
  if (Result.isError(written)) {
    console.error(
      "[enforcement] failed to persist cleanup.lastRunAt",
      written.error
    );
    throw written.error;
  }
  return now;
}

export async function runConfiguredCleanup() {
  const c = await readKeyOr("cleanup", Cleanup.parse({}));
  if (Result.isError(c)) {
    throw c.error;
  }
  const lastRunAt = await runCleanupWithConfig(c.value);
  return { lastRunAt };
}

export async function runOnCloseCleanup() {
  const c = await readKeyOr("cleanup", Cleanup.parse({}));
  if (Result.isError(c)) {
    return;
  }
  if (c.value.schedule !== "on-close") {
    return;
  }
  try {
    await runCleanupWithConfig(c.value);
  } catch (err) {
    console.error("[enforcement] runOnCloseCleanup failed", err);
  }
}

export function registerCleanupMessages() {
  extensionMessaging.onMessage("cleanup.runNow", () => runConfiguredCleanup());
}

export async function runCleanup(
  retention: keyof typeof RETENTION_MS,
  whitelistExempt: boolean
) {
  const ms = RETENTION_MS[retention];
  if (ms === undefined) {
    return;
  }
  const cutoff = Date.now() - ms;
  if (!whitelistExempt) {
    await history.deleteRange({ startTime: 0, endTime: cutoff });
    return;
  }

  const wl = await readKeyOr("whitelist", []);
  if (Result.isError(wl)) {
    return;
  }
  if (wl.value.length === 0) {
    await history.deleteRange({ startTime: 0, endTime: cutoff });
    return;
  }

  const r = await history.search({
    text: "",
    maxResults: 100_000,
    startTime: 0,
    endTime: cutoff,
  });
  if (Result.isError(r)) {
    return;
  }
  const { anyRuleMatches } = await import("@/lib/patterns");
  for (const item of r.value) {
    if (!item.url) {
      continue;
    }
    if (anyRuleMatches(wl.value, item.url)) {
      continue;
    }
    await history.deleteUrl({ url: item.url });
  }
}

import { z } from "zod";

export const PatternKind = z.enum([
  "exact",
  "subdomain",
  "specific-sub",
  "path",
  "page",
]);
export type PatternKind = z.infer<typeof PatternKind>;

export const DomainRule = z.object({
  pattern: z.string().min(1),
  kind: PatternKind,
});
export type DomainRule = z.infer<typeof DomainRule>;

export const Settings = z.object({
  darkMode: z.enum(["system", "light", "dark"]).default("system"),
  fontSize: z.enum(["small", "medium", "large"]).default("medium"),
  dir: z.enum(["ltr", "rtl"]).default("ltr"),
  dateFormat: z.string().default("MMM d, yyyy"),
  hourFormat: z.enum(["12", "24"]).default("12"),
  toolbarIcon: z.enum(["default", "light", "dark"]).default("default"),
  infinityScroll: z.boolean().default(true),
  opentab: z.boolean().default(true),
  searchDomain: z.boolean().default(true),
  searchText: z.boolean().default(true),
  enablePopup: z.boolean().default(true),
  enableStats: z.boolean().default(false),
  whitelistPrecedence: z.boolean().default(true),
});
export type Settings = z.infer<typeof Settings>;

export const Cleanup = z.object({
  schedule: z
    .enum(["never", "on-close", "daily", "weekly", "monthly"])
    .default("never"),
  retention: z.enum(["1w", "2w", "1m", "3m"]).default("3m"),
  whitelistExempt: z.boolean().default(true),
  lastRunAt: z.number().int().nonnegative().optional(),
});
export type Cleanup = z.infer<typeof Cleanup>;

export const DomainSession = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export const DomainTracking = z.object({
  totalSec: z.number().int().nonnegative().default(0),
  sessions: z.array(DomainSession).default([]),
  lastVisit: z.number().int().nonnegative().optional(),
  days: z.record(z.string(), z.number().int().nonnegative()).default({}),
});
export type DomainTracking = z.infer<typeof DomainTracking>;

export const TrackingData = z.record(z.string(), DomainTracking);
export type TrackingData = z.infer<typeof TrackingData>;

export const Meta = z.object({
  firstInit: z.boolean().default(true),
  lastReloadTime: z.number().int().nonnegative().optional(),
  wasRunning: z.boolean().default(false),
  installedVersion: z.string().optional(),
});
export type Meta = z.infer<typeof Meta>;

export const StorageSchema = {
  settings: Settings,
  cleanup: Cleanup,
  blacklist: z.array(DomainRule),
  whitelist: z.array(DomainRule),
  tracking: TrackingData,
  meta: Meta,
} as const;

export type StorageSchema = typeof StorageSchema;
export type StorageKey = keyof StorageSchema;
export type StorageValue<K extends StorageKey> = z.infer<StorageSchema[K]>;

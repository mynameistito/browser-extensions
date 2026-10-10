import { z } from "zod";

export const PatternKindSchema = z.enum([
  "exact",
  "subdomain",
  "specific-sub",
  "path",
  "page",
]);
export type PatternKind = z.infer<typeof PatternKindSchema>;

export const DomainRuleSchema = z.object({
  kind: PatternKindSchema,
  pattern: z.string().min(1),
});
export type DomainRule = z.infer<typeof DomainRuleSchema>;

export const SettingsSchema = z.object({
  darkMode: z.enum(["system", "light", "dark"]).default("system"),
  dateFormat: z.string().default("MMM d, yyyy"),
  dir: z.enum(["ltr", "rtl"]).default("ltr"),
  enablePopup: z.boolean().default(true),
  enableStats: z.boolean().default(false),
  fontSize: z.enum(["small", "medium", "large"]).default("medium"),
  hourFormat: z.enum(["12", "24"]).default("12"),
  infinityScroll: z.boolean().default(true),
  opentab: z.boolean().default(true),
  searchDomain: z.boolean().default(true),
  searchText: z.boolean().default(true),
  toolbarIcon: z.enum(["default", "light", "dark"]).default("default"),
  whitelistPrecedence: z.boolean().default(true),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const CleanupSchema = z.object({
  lastRunAt: z.number().int().nonnegative().optional(),
  retention: z.enum(["1w", "2w", "1m", "3m"]).default("3m"),
  schedule: z
    .enum(["never", "on-close", "daily", "weekly", "monthly"])
    .default("never"),
  whitelistExempt: z.boolean().default(true),
});
export type Cleanup = z.infer<typeof CleanupSchema>;

export const DomainSession = z.object({
  end: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
});

export const DomainTrackingSchema = z.object({
  days: z.record(z.string(), z.number().int().nonnegative()).default({}),
  lastVisit: z.number().int().nonnegative().optional(),
  sessions: z.array(DomainSession).default([]),
  totalSec: z.number().int().nonnegative().default(0),
});
export type DomainTracking = z.infer<typeof DomainTrackingSchema>;

export const TrackingDataSchema = z.record(z.string(), DomainTrackingSchema);
export type TrackingData = z.infer<typeof TrackingDataSchema>;

export const MetaSchema = z.object({
  firstInit: z.boolean().default(true),
  installedVersion: z.string().optional(),
  lastReloadTime: z.number().int().nonnegative().optional(),
  wasRunning: z.boolean().default(false),
});
export type Meta = z.infer<typeof MetaSchema>;

export const StorageSchema = {
  blacklist: z.array(DomainRuleSchema),
  cleanup: CleanupSchema,
  meta: MetaSchema,
  settings: SettingsSchema,
  tracking: TrackingDataSchema,
  whitelist: z.array(DomainRuleSchema),
} as const;

export type StorageKey = keyof typeof StorageSchema;
export type StorageValue<K extends StorageKey> = z.infer<
  (typeof StorageSchema)[K]
>;

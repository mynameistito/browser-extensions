import { z } from "zod";

export const PatternKindSchema = z.enum([
  "exact",
  "subdomain",
  "specific-sub",
  "path",
  "page",
]);

/** Supported matching modes for domain rules. */
export type PatternKind = z.infer<typeof PatternKindSchema>;

export const DomainRuleSchema = z.object({
  kind: PatternKindSchema,
  pattern: z.string().min(1),
});

/** A normalized URL matching rule. */
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

/** User preferences for the extension interface and search behavior. */
export type Settings = z.infer<typeof SettingsSchema>;

export const CleanupSchema = z.object({
  lastRunAt: z.number().int().nonnegative().optional(),
  retention: z.enum(["1w", "2w", "1m", "3m"]).default("3m"),
  schedule: z
    .enum(["never", "on-close", "daily", "weekly", "monthly"])
    .default("never"),
  whitelistExempt: z.boolean().default(true),
});

/** Schedule and retention preferences for history cleanup. */
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

/** Visit statistics stored for one domain. */
export type DomainTracking = z.infer<typeof DomainTrackingSchema>;

export const TrackingDataSchema = z.record(z.string(), DomainTrackingSchema);

/** Visit statistics indexed by domain. */
export type TrackingData = z.infer<typeof TrackingDataSchema>;

export const MetaSchema = z.object({
  firstInit: z.boolean().default(true),
  installedVersion: z.string().optional(),
  lastReloadTime: z.number().int().nonnegative().optional(),
  wasRunning: z.boolean().default(false),
});

/** Installation metadata persisted by the extension. */
export type Meta = z.infer<typeof MetaSchema>;

interface StorageValueMap {
  blacklist: DomainRule[];
  cleanup: Cleanup;
  meta: Meta;
  settings: Settings;
  tracking: TrackingData;
  whitelist: DomainRule[];
}

type StorageSchemaContract = {
  [K in keyof StorageValueMap]: z.ZodType<StorageValueMap[K]>;
};

export const StorageSchema: StorageSchemaContract = {
  blacklist: z.array(DomainRuleSchema),
  cleanup: CleanupSchema,
  meta: MetaSchema,
  settings: SettingsSchema,
  tracking: TrackingDataSchema,
  whitelist: z.array(DomainRuleSchema),
};

/** Keys supported by the extension's local storage schema. */
export type StorageKey = keyof StorageValueMap;

/** Parsed storage value for a specific storage key. */
export type StorageValue<K extends StorageKey> = StorageValueMap[K];

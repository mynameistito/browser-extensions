import {
  endOfYesterday,
  startOfDay,
  startOfYesterday,
  subDays,
} from "date-fns";

export const PRESETS = [
  "today",
  "yesterday",
  "7d",
  "15d",
  "30d",
  "60d",
  "90d",
  "all",
] as const;

/** A supported time window for history searches. */
export type Preset = (typeof PRESETS)[number];

/** Start and end timestamps for a history search range. */
export interface TimeRange {
  endTime: number;
  startTime: number;
}

/**
 * Convert a preset into timestamps for a history query.
 * @param preset - The selected time range preset.
 * @returns Inclusive start and end timestamps in milliseconds.
 */
export const presetRange = (preset: Preset): TimeRange => {
  const now = new Date();

  switch (preset) {
    case "today": {
      return { endTime: now.getTime(), startTime: startOfDay(now).getTime() };
    }

    case "yesterday": {
      return {
        endTime: endOfYesterday().getTime(),
        startTime: startOfYesterday().getTime(),
      };
    }

    case "7d": {
      return { endTime: now.getTime(), startTime: subDays(now, 7).getTime() };
    }

    case "15d": {
      return { endTime: now.getTime(), startTime: subDays(now, 15).getTime() };
    }

    case "30d": {
      return { endTime: now.getTime(), startTime: subDays(now, 30).getTime() };
    }

    case "60d": {
      return { endTime: now.getTime(), startTime: subDays(now, 60).getTime() };
    }

    case "90d": {
      return { endTime: now.getTime(), startTime: subDays(now, 90).getTime() };
    }

    case "all": {
      return { endTime: now.getTime(), startTime: 0 };
    }

    default: {
      return { endTime: now.getTime(), startTime: 0 };
    }
  }
};

export const PRESET_LABELS: Record<Preset, string> = {
  "15d": "Last 15 days",
  "30d": "Last 30 days",
  "60d": "Last 60 days",
  "7d": "Last 7 days",
  "90d": "Last 90 days",
  all: "All time",
  today: "Today",
  yesterday: "Yesterday",
};

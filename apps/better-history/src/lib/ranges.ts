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
export type Preset = (typeof PRESETS)[number];

export function presetRange(preset: Preset): {
  startTime: number;
  endTime: number;
} {
  const now = new Date();
  switch (preset) {
    case "today":
      return { startTime: startOfDay(now).getTime(), endTime: now.getTime() };
    case "yesterday":
      return {
        startTime: startOfYesterday().getTime(),
        endTime: endOfYesterday().getTime(),
      };
    case "7d":
      return { startTime: subDays(now, 7).getTime(), endTime: now.getTime() };
    case "15d":
      return { startTime: subDays(now, 15).getTime(), endTime: now.getTime() };
    case "30d":
      return { startTime: subDays(now, 30).getTime(), endTime: now.getTime() };
    case "60d":
      return { startTime: subDays(now, 60).getTime(), endTime: now.getTime() };
    case "90d":
      return { startTime: subDays(now, 90).getTime(), endTime: now.getTime() };
    case "all":
      return { startTime: 0, endTime: now.getTime() };
    default:
      return { startTime: 0, endTime: now.getTime() };
  }
}

export const PRESET_LABELS: Record<Preset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "15d": "Last 15 days",
  "30d": "Last 30 days",
  "60d": "Last 60 days",
  "90d": "Last 90 days",
  all: "All time",
};

import { Schema } from "effect";

/** Supported web search providers. */
export type SearchProvider = "google" | "bing" | "duckduckgo";
export type WidgetId = "clock" | "search" | "weather";
export type WidgetSpan = 1 | 2 | 3;

/** Supported color theme preferences. */
type ThemePreference = "system" | "light" | "dark";

/** A manually selected weather location. */
export interface WeatherLocation {
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
}

/** User-editable preferences stored on this device. */
export interface Preferences {
  readonly searchProvider: SearchProvider;
  readonly theme: ThemePreference;
  readonly backgroundEnabled: boolean;
  readonly backgroundChangeNonce: number;
  readonly weatherLocation: WeatherLocation | null;
  readonly widgetLayout: readonly WidgetPlacement[];
}

/** Visibility and grid width for one dashboard widget. */
export interface WidgetPlacement {
  readonly id: WidgetId;
  readonly visible: boolean;
  readonly span: WidgetSpan;
}

/** Safe initial values for a new installation. */
export const DEFAULT_PREFERENCES: Preferences = {
  searchProvider: "google",
  theme: "system",
  backgroundEnabled: true,
  backgroundChangeNonce: 0,
  weatherLocation: null,
  widgetLayout: [
    { id: "clock", visible: true, span: 2 },
    { id: "search", visible: true, span: 3 },
    { id: "weather", visible: false, span: 1 },
  ],
};

const WidgetPlacementSchema = Schema.Struct({
  id: Schema.Literal("clock", "search", "weather"),
  visible: Schema.Boolean,
  span: Schema.Literal(1, 2, 3),
});

const WeatherLocationSchema = Schema.Struct({
  name: Schema.String,
  region: Schema.String,
  country: Schema.String,
  latitude: Schema.Number.pipe(Schema.between(-90, 90)),
  longitude: Schema.Number.pipe(Schema.between(-180, 180)),
  timezone: Schema.String,
});

export const PreferencesSchema = Schema.Struct({
  searchProvider: Schema.Literal("google", "bing", "duckduckgo"),
  theme: Schema.Literal("system", "light", "dark"),
  backgroundEnabled: Schema.Boolean,
  backgroundChangeNonce: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  weatherLocation: Schema.NullOr(WeatherLocationSchema),
  widgetLayout: Schema.optional(Schema.Array(WidgetPlacementSchema)),
});

/** Ensure persisted layouts include each supported widget exactly once. */
export const normalizeWidgetLayout = (
  layout: readonly WidgetPlacement[]
): readonly WidgetPlacement[] => {
  const seen = new Set<WidgetId>();
  const unique = layout.filter((placement) => {
    if (seen.has(placement.id)) {
      return false;
    }

    seen.add(placement.id);
    return true;
  });

  return [
    ...unique,
    ...DEFAULT_PREFERENCES.widgetLayout.filter(
      (placement) => !seen.has(placement.id)
    ),
  ];
};

/** Move an item among visible widgets while preserving hidden widget order. */
export const moveWidget = (
  layout: readonly WidgetPlacement[],
  id: WidgetId,
  direction: -1 | 1
): readonly WidgetPlacement[] => {
  const visibleIndexes = layout.flatMap((placement, index) =>
    placement.visible ? [index] : []
  );
  const currentIndex = visibleIndexes.findIndex(
    (index) => layout[index]?.id === id
  );
  const destinationIndex = currentIndex + direction;
  const currentPosition = visibleIndexes[currentIndex];
  const destinationPosition = visibleIndexes[destinationIndex];

  if (currentPosition === undefined || destinationPosition === undefined) {
    return layout;
  }

  const next = [...layout];
  const current = next[currentPosition];
  const destination = next[destinationPosition];

  if (current && destination) {
    next[currentPosition] = destination;
    next[destinationPosition] = current;
  }

  return next;
};

/** Swap two visible widgets, as used when a card is dropped on another. */
export const swapWidgetPositions = (
  layout: readonly WidgetPlacement[],
  firstId: WidgetId,
  secondId: WidgetId
): readonly WidgetPlacement[] => {
  const firstIndex = layout.findIndex(
    (placement) => placement.visible && placement.id === firstId
  );
  const secondIndex = layout.findIndex(
    (placement) => placement.visible && placement.id === secondId
  );

  if (firstIndex === -1 || secondIndex === -1 || firstIndex === secondIndex) {
    return layout;
  }

  const next = [...layout];
  const first = next[firstIndex];
  const second = next[secondIndex];

  if (first && second) {
    next[firstIndex] = second;
    next[secondIndex] = first;
  }

  return next;
};

/** Change the grid width for one widget. */
export const resizeWidget = (
  layout: readonly WidgetPlacement[],
  id: WidgetId,
  span: WidgetSpan
): readonly WidgetPlacement[] =>
  layout.map((placement) =>
    placement.id === id ? { ...placement, span } : placement
  );

import { Schema } from "effect";

/** Supported web search providers. */
export type SearchProvider = "google" | "bing" | "duckduckgo";

/** Stable identifier for a supported dashboard widget. */
export type WidgetId = "clock" | "search" | "weather";

/** Number of grid columns a widget may occupy. */
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
  backgroundChangeNonce: 0,
  backgroundEnabled: true,
  searchProvider: "google",
  theme: "system",
  weatherLocation: null,
  widgetLayout: [
    { id: "clock", span: 2, visible: true },
    { id: "search", span: 3, visible: true },
    { id: "weather", span: 1, visible: false },
  ],
};

const WidgetPlacementSchema = Schema.Struct({
  id: Schema.Literal("clock", "search", "weather"),
  span: Schema.Literal(1, 2, 3),
  visible: Schema.Boolean,
});

const WeatherLocationSchema = Schema.Struct({
  country: Schema.String,
  latitude: Schema.Number.pipe(Schema.between(-90, 90)),
  longitude: Schema.Number.pipe(Schema.between(-180, 180)),
  name: Schema.String,
  region: Schema.String,
  timezone: Schema.String,
});

export const PreferencesSchema = Schema.Struct({
  backgroundChangeNonce: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  backgroundEnabled: Schema.Boolean,
  searchProvider: Schema.Literal("google", "bing", "duckduckgo"),
  theme: Schema.Literal("system", "light", "dark"),
  weatherLocation: Schema.NullOr(WeatherLocationSchema),
  widgetLayout: Schema.optional(Schema.Array(WidgetPlacementSchema)),
});

/**
 * Ensure persisted layouts include each supported widget exactly once.
 * @param layout - Layout entries read from preferences.
 * @returns A layout with duplicate entries removed and missing widgets added.
 */
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

/**
 * Move an item among visible widgets while preserving hidden widget order.
 * @param layout - Current widget layout.
 * @param id - Visible widget to move.
 * @param direction - One visible position left or right.
 * @returns The updated layout, or the original when movement is out of bounds.
 */
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

  if (current === undefined || destination === undefined) {
    return layout;
  }

  next[currentPosition] = destination;
  next[destinationPosition] = current;

  return next;
};

/**
 * Swap two visible widgets, as used when a card is dropped on another.
 * @param layout - Current widget layout.
 * @param firstId - First visible widget.
 * @param secondId - Second visible widget.
 * @returns The updated layout, or the original when either widget is absent.
 */
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

  if (first === undefined || second === undefined) {
    return layout;
  }

  next[firstIndex] = second;
  next[secondIndex] = first;

  return next;
};

/**
 * Change the grid width for one widget.
 * @param layout - Current widget layout.
 * @param id - Widget whose width should change.
 * @param span - New grid width.
 * @returns The layout with the selected widget resized.
 */
export const resizeWidget = (
  layout: readonly WidgetPlacement[],
  id: WidgetId,
  span: WidgetSpan
): readonly WidgetPlacement[] =>
  layout.map((placement) =>
    placement.id === id ? { ...placement, span } : placement
  );

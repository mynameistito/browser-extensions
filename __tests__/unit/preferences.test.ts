import { Either, Schema } from "effect";
import { describe, expect, test } from "vitest";

import {
  DEFAULT_PREFERENCES,
  moveWidget,
  normalizeWidgetLayout,
  PreferencesSchema,
  resizeWidget,
  swapWidgetPositions,
} from "../../src/lib/preferences";

describe("PreferencesSchema", () => {
  test("accepts the default first-run preferences", () => {
    const result =
      Schema.decodeUnknownEither(PreferencesSchema)(DEFAULT_PREFERENCES);

    expect(Either.isRight(result)).toBe(true);
  });

  test("rejects unsupported providers and invalid city coordinates", () => {
    const invalidProvider = Schema.decodeUnknownEither(PreferencesSchema)({
      ...DEFAULT_PREFERENCES,
      searchProvider: "example",
    });
    const invalidCoordinates = Schema.decodeUnknownEither(PreferencesSchema)({
      ...DEFAULT_PREFERENCES,
      weatherLocation: {
        name: "Nowhere",
        region: "",
        country: "N/A",
        latitude: 95,
        longitude: 0,
        timezone: "UTC",
      },
    });

    expect(Either.isLeft(invalidProvider)).toBe(true);
    expect(Either.isLeft(invalidCoordinates)).toBe(true);
  });

  test("accepts stored preferences created before widget layout was added", () => {
    const decoded = Schema.decodeUnknownEither(PreferencesSchema)({
      searchProvider: "bing",
      theme: "light",
      backgroundEnabled: false,
      backgroundChangeNonce: 4,
      weatherLocation: null,
    });

    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded)) {
      expect(
        normalizeWidgetLayout(
          decoded.right.widgetLayout ?? DEFAULT_PREFERENCES.widgetLayout
        )
      ).toEqual(DEFAULT_PREFERENCES.widgetLayout);
    }
  });

  test("normalizes, moves, and swaps visible widgets without dropping hidden ones", () => {
    const layout = normalizeWidgetLayout([
      { id: "weather", visible: true, span: 1 },
      { id: "weather", visible: false, span: 3 },
    ]);

    expect(layout.map(({ id }) => id)).toEqual(["weather", "clock", "search"]);
    expect(moveWidget(layout, "clock", 1).map(({ id }) => id)).toEqual([
      "weather",
      "search",
      "clock",
    ]);

    const visibleLayout = layout.map((item) => ({ ...item, visible: true }));
    expect(
      swapWidgetPositions(visibleLayout, "weather", "search").map(
        ({ id }) => id
      )
    ).toEqual(["search", "clock", "weather"]);
    expect(
      resizeWidget(layout, "clock", 3).find(({ id }) => id === "clock")?.span
    ).toBe(3);
  });

  test("leaves layouts unchanged when a widget cannot be moved or swapped", () => {
    const layout = DEFAULT_PREFERENCES.widgetLayout;
    expect(moveWidget(layout, "clock", -1)).toBe(layout);
    expect(moveWidget(layout, "weather", 1)).toBe(layout);
    expect(swapWidgetPositions(layout, "clock", "clock")).toBe(layout);
    expect(swapWidgetPositions(layout, "clock", "weather")).toBe(layout);
  });
});

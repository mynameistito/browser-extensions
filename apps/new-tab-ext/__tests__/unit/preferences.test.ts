import { Result, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_PREFERENCES,
  moveWidget,
  normalizeWidgetLayout,
  PreferencesSchema,
  resizeWidget,
  swapWidgetPositions,
} from "../../src/lib/preferences";
import {
  cleanupTestEnvironment,
  setupTestEnvironment,
} from "../helpers/test-environment";

describe(PreferencesSchema, () => {
  beforeEach(setupTestEnvironment);
  afterEach(cleanupTestEnvironment);

  it("accepts the default first-run preferences", () => {
    const result =
      Schema.decodeUnknownResult(PreferencesSchema)(DEFAULT_PREFERENCES);

    expect(Result.isSuccess(result)).toBeTruthy();
  });

  it("rejects unsupported providers and invalid city coordinates", () => {
    const invalidProvider = Schema.decodeUnknownResult(PreferencesSchema)({
      ...DEFAULT_PREFERENCES,
      searchProvider: "example",
    });

    const invalidCoordinates = Schema.decodeUnknownResult(PreferencesSchema)({
      ...DEFAULT_PREFERENCES,
      weatherLocation: {
        country: "N/A",
        latitude: 95,
        longitude: 0,
        name: "Nowhere",
        region: "",
        timezone: "UTC",
      },
    });

    expect(Result.isFailure(invalidProvider)).toBeTruthy();
    expect(Result.isFailure(invalidCoordinates)).toBeTruthy();
  });

  it("accepts stored preferences created before widget layout was added", () => {
    const decoded = Schema.decodeUnknownSync(PreferencesSchema)({
      backgroundChangeNonce: 4,
      backgroundEnabled: false,
      searchProvider: "bing",
      theme: "light",
      weatherLocation: null,
    });

    expect(
      normalizeWidgetLayout(
        decoded.widgetLayout ?? DEFAULT_PREFERENCES.widgetLayout
      )
    ).toStrictEqual(DEFAULT_PREFERENCES.widgetLayout);
  });

  it("normalizes, moves, and swaps visible widgets without dropping hidden ones", () => {
    const layout = normalizeWidgetLayout([
      { id: "weather", span: 1, visible: true },
      { id: "weather", span: 3, visible: false },
    ]);

    expect(layout.map(({ id }) => id)).toStrictEqual([
      "weather",
      "clock",
      "search",
    ]);
    expect(moveWidget(layout, "clock", 1).map(({ id }) => id)).toStrictEqual([
      "weather",
      "search",
      "clock",
    ]);

    const visibleLayout = layout.map((item) => ({ ...item, visible: true }));
    expect(
      swapWidgetPositions(visibleLayout, "weather", "search").map(
        ({ id }) => id
      )
    ).toStrictEqual(["search", "clock", "weather"]);
    expect(
      resizeWidget(layout, "clock", 3).find(({ id }) => id === "clock")?.span
    ).toBe(3);
  });

  it("leaves layouts unchanged when a widget cannot be moved or swapped", () => {
    const layout = DEFAULT_PREFERENCES.widgetLayout;
    expect(moveWidget(layout, "clock", -1)).toBe(layout);
    expect(moveWidget(layout, "weather", 1)).toBe(layout);
    expect(swapWidgetPositions(layout, "clock", "clock")).toBe(layout);
    expect(swapWidgetPositions(layout, "clock", "weather")).toBe(layout);
  });
});

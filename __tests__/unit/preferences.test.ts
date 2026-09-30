import { describe, expect, test } from "bun:test";

import { Either, Schema } from "effect";

import {
  DEFAULT_PREFERENCES,
  PreferencesSchema,
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
});

import { Either, Schema } from "effect";
import { describe, expect, test } from "vitest";

import {
  CityResponseSchema,
  CurrentWeatherSchema,
  describeWeatherCode,
  parseCityResults,
  parseCurrentWeather,
} from "../../src/lib/weather";

describe("Open-Meteo response decoding", () => {
  test("maps a geocoding result to a city choice", () => {
    const decoded = Schema.decodeUnknownEither(CityResponseSchema)({
      results: [
        {
          id: 123,
          name: "Helsinki",
          admin1: "Uusimaa",
          country: "Finland",
          latitude: 60.17,
          longitude: 24.94,
          timezone: "Europe/Helsinki",
        },
      ],
    });

    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded)) {
      expect(parseCityResults(decoded.right)).toEqual([
        {
          id: 123,
          name: "Helsinki",
          region: "Uusimaa",
          country: "Finland",
          latitude: 60.17,
          longitude: 24.94,
          timezone: "Europe/Helsinki",
        },
      ]);
    }
  });

  test("handles missing, empty, and regionless geocoding results", () => {
    expect(parseCityResults({})).toEqual([]);
    expect(
      parseCityResults({
        results: [
          {
            id: 4,
            name: "Oslo",
            country: "Norway",
            latitude: 59.9,
            longitude: 10.7,
            timezone: "Europe/Oslo",
          },
        ],
      })[0]?.region
    ).toBe("");
  });

  test("rejects malformed forecast conditions and maps valid conditions", () => {
    const invalid = Schema.decodeUnknownEither(CurrentWeatherSchema)({
      current: { temperature_2m: "cold" },
    });
    const decoded = Schema.decodeUnknownEither(CurrentWeatherSchema)({
      current: {
        temperature_2m: 14.3,
        apparent_temperature: 12,
        relative_humidity_2m: 73,
        wind_speed_10m: 8.1,
        weather_code: 61,
        is_day: 1,
        time: "2026-09-30T12:00",
      },
    });

    expect(Either.isLeft(invalid)).toBe(true);
    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded)) {
      expect(parseCurrentWeather(decoded.right)).toEqual({
        temperature: 14.3,
        apparentTemperature: 12,
        relativeHumidity: 73,
        windSpeed: 8.1,
        weatherCode: 61,
        isDay: true,
        observedAt: "2026-09-30T12:00",
      });
    }
  });

  test("describes common weather codes", () => {
    const cases: readonly (readonly [number, string])[] = [
      [0, "Clear sky"],
      [1, "Mostly clear"],
      [2, "Partly cloudy"],
      [3, "Overcast"],
      [45, "Fog"],
      [48, "Fog"],
      [51, "Drizzle"],
      [57, "Drizzle"],
      [61, "Rain"],
      [67, "Rain"],
      [71, "Snow"],
      [77, "Snow"],
      [80, "Rain showers"],
      [82, "Rain showers"],
      [85, "Snow showers"],
      [86, "Snow showers"],
      [95, "Thunderstorms"],
      [96, "Thunderstorms"],
      [99, "Thunderstorms"],
      [255, "Current conditions"],
    ];

    for (const [code, description] of cases) {
      expect(describeWeatherCode(code)).toBe(description);
    }
  });
});

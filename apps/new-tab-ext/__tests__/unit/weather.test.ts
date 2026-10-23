import { Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  CityResponseSchema,
  CurrentWeatherSchema,
  describeWeatherCode,
  parseCityResults,
  parseCurrentWeather,
} from "../../src/lib/weather";

describe("Open-Meteo response decoding", () => {
  it("maps a geocoding result to a city choice", () => {
    const decoded = Schema.decodeUnknownSync(CityResponseSchema)({
      results: [
        {
          admin1: "Uusimaa",
          country: "Finland",
          id: 123,
          latitude: 60.17,
          longitude: 24.94,
          name: "Helsinki",
          timezone: "Europe/Helsinki",
        },
      ],
    });

    expect(parseCityResults(decoded)).toStrictEqual([
      {
        country: "Finland",
        id: 123,
        latitude: 60.17,
        longitude: 24.94,
        name: "Helsinki",
        region: "Uusimaa",
        timezone: "Europe/Helsinki",
      },
    ]);
  });

  it("handles missing, empty, and regionless geocoding results", () => {
    expect(parseCityResults({})).toStrictEqual([]);
    expect(
      parseCityResults({
        results: [
          {
            country: "Norway",
            id: 4,
            latitude: 59.9,
            longitude: 10.7,
            name: "Oslo",
            timezone: "Europe/Oslo",
          },
        ],
      })[0]?.region
    ).toBe("");
  });

  it("rejects malformed forecast conditions and maps valid conditions", () => {
    const invalid = Schema.decodeUnknownEither(CurrentWeatherSchema)({
      current: { temperature_2m: "cold" },
    });

    const decoded = Schema.decodeUnknownSync(CurrentWeatherSchema)({
      current: {
        apparent_temperature: 12,
        is_day: 1,
        relative_humidity_2m: 73,
        temperature_2m: 14.3,
        time: "2026-09-30T12:00",
        weather_code: 61,
        wind_speed_10m: 8.1,
      },
    });

    expect(Either.isLeft(invalid)).toBeTruthy();
    expect(parseCurrentWeather(decoded)).toStrictEqual({
      apparentTemperature: 12,
      isDay: true,
      observedAt: "2026-09-30T12:00",
      relativeHumidity: 73,
      temperature: 14.3,
      weatherCode: 61,
      windSpeed: 8.1,
    });
  });

  it("describes common weather codes", () => {
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

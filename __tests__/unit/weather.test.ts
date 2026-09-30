import { describe, expect, test } from "bun:test";

import { Either, Schema } from "effect";

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
    expect(describeWeatherCode(0)).toBe("Clear sky");
    expect(describeWeatherCode(95)).toBe("Thunderstorms");
    expect(describeWeatherCode(255)).toBe("Current conditions");
  });
});

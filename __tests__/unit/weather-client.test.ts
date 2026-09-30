import { Effect, Either } from "effect";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { WeatherLocation } from "../../src/lib/preferences";
import { loadCurrentWeather, searchCities } from "../../src/lib/weather-client";
import {
  clearWxtStorage,
  failWxtStorage,
  seedWxtStorage,
} from "../helpers/wxt-imports";

const location: WeatherLocation = {
  name: "Helsinki",
  region: "Uusimaa",
  country: "Finland",
  latitude: 60.17,
  longitude: 24.94,
  timezone: "Europe/Helsinki",
};

const forecastPayload = {
  current: {
    temperature_2m: 14.3,
    apparent_temperature: 12,
    relative_humidity_2m: 73,
    wind_speed_10m: 8.1,
    weather_code: 61,
    is_day: 1,
    time: "2026-09-30T12:00",
  },
};

const cityPayload = {
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
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

const jsonResponse = (
  payload: { readonly [key: string]: JsonValue },
  status = 200
): Response => Response.json(payload, { status });

describe("Open-Meteo client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  });

  test("skips city searches shorter than two characters", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(Effect.runPromise(searchCities(" x "))).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("searches normalized city names and parses results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(cityPayload))
    );

    await expect(
      Effect.runPromise(searchCities(" Helsinki "))
    ).resolves.toEqual([
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
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(
      "name=Helsinki"
    );
  });

  test.each([
    [
      "HTTP failure",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 503)),
    ],
    [
      "network failure",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
    ],
    [
      "invalid JSON",
      vi.fn<typeof fetch>().mockResolvedValue(new Response("not-json")),
    ],
    [
      "invalid provider data",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse({ results: [{ name: 3 }] })),
    ],
  ])("maps city search %s to a typed failure", async (_name, fetchMock) => {
    vi.stubGlobal("fetch", fetchMock);
    const result = await Effect.runPromise(
      Effect.either(searchCities("Helsinki"))
    );
    expect(Either.isLeft(result)).toBe(true);
  });

  test("returns a fresh matching cache without a request", async () => {
    seedWxtStorage("local:weather-cache", {
      locationKey: "60.17,24.94",
      fetchedAt: Date.now() - 1000,
      weather: {
        temperature: 13,
        apparentTemperature: 11,
        relativeHumidity: 70,
        windSpeed: 5,
        weatherCode: 2,
        isDay: true,
        observedAt: "2026-09-30T11:00",
      },
    });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const reading = await Effect.runPromise(loadCurrentWeather(location));
    expect(reading.weather.temperature).toBe(13);
    expect(reading.isStale).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("fetches forecasts, writes cache, and converts daytime data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(forecastPayload))
    );

    await expect(
      Effect.runPromise(loadCurrentWeather(location))
    ).resolves.toEqual({
      weather: {
        temperature: 14.3,
        apparentTemperature: 12,
        relativeHumidity: 73,
        windSpeed: 8.1,
        weatherCode: 61,
        isDay: true,
        observedAt: "2026-09-30T12:00",
      },
      isStale: false,
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  test("supports nighttime forecasts and auto timezone fallback", async () => {
    const nighttimeLocation = { ...location, timezone: "" };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ current: { ...forecastPayload.current, is_day: 0 } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const reading = await Effect.runPromise(
      loadCurrentWeather(nighttimeLocation)
    );
    expect(reading.weather.isDay).toBe(false);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("timezone=auto");
  });

  test("falls back to stale data for the same location after a request failure", async () => {
    const weather = {
      temperature: 4,
      apparentTemperature: 1,
      relativeHumidity: 80,
      windSpeed: 3,
      weatherCode: 3,
      isDay: false,
      observedAt: "2026-09-29T12:00",
    };
    seedWxtStorage("local:weather-cache", {
      locationKey: "60.17,24.94",
      fetchedAt: Date.now() - 60 * 60 * 1000,
      weather,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))
    );

    await expect(
      Effect.runPromise(loadCurrentWeather(location))
    ).resolves.toEqual({
      weather,
      isStale: true,
    });
  });

  test("does not use another city's stale cache when the forecast fails", async () => {
    seedWxtStorage("local:weather-cache", {
      locationKey: "0,0",
      fetchedAt: Date.now() - 60 * 60 * 1000,
      weather: forecastPayload.current,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 500))
    );

    const result = await Effect.runPromise(
      Effect.either(loadCurrentWeather(location))
    );
    expect(Either.isLeft(result)).toBe(true);
  });

  test("continues when cache reads or writes fail", async () => {
    failWxtStorage("local:weather-cache", "read", new Error("read failed"));
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(forecastPayload))
    );
    await expect(
      Effect.runPromise(loadCurrentWeather(location))
    ).resolves.toMatchObject({
      weather: { temperature: 14.3 },
      isStale: false,
    });

    clearWxtStorage();
    failWxtStorage("local:weather-cache", "write", new Error("write failed"));
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(forecastPayload))
    );
    await expect(
      Effect.runPromise(loadCurrentWeather(location))
    ).resolves.toMatchObject({
      weather: { temperature: 14.3 },
    });
  });
});

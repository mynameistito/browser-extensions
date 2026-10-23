import { Effect, Either } from "effect";
import { beforeEach, describe, expect, vi, it } from "vitest";

import type { WeatherLocation } from "../../src/lib/preferences";
import { loadCurrentWeather, searchCities } from "../../src/lib/weather-client";
import {
  clearWxtStorage,
  failWxtStorage,
  seedWxtStorage,
} from "../helpers/wxt-imports";

const location: WeatherLocation = {
  country: "Finland",
  latitude: 60.17,
  longitude: 24.94,
  name: "Helsinki",
  region: "Uusimaa",
  timezone: "Europe/Helsinki",
};

const forecastPayload = {
  current: {
    apparent_temperature: 12,
    is_day: 1,
    relative_humidity_2m: 73,
    temperature_2m: 14.3,
    time: "2026-09-30T12:00",
    weather_code: 61,
    wind_speed_10m: 8.1,
  },
};

const cityPayload = {
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

const requestUrl = (input: RequestInfo | URL | undefined): string => {
  if (input instanceof Request) {
    return input.url;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input ?? "";
};

describe("Open-Meteo client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  });

  it("skips city searches shorter than two characters", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(Effect.runPromise(searchCities(" x "))).resolves.toStrictEqual(
      []
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("searches normalized city names and parses results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(cityPayload))
    );

    await expect(
      Effect.runPromise(searchCities(" Helsinki "))
    ).resolves.toStrictEqual([
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
    expect(requestUrl(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(
      "name=Helsinki"
    );
  });

  it.each([
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

    expect(Either.isLeft(result)).toBeTruthy();
  });

  it("returns a fresh matching cache without a request", async () => {
    seedWxtStorage("local:weather-cache", {
      fetchedAt: Date.now() - 1000,
      locationKey: "60.17,24.94",
      weather: {
        apparentTemperature: 11,
        isDay: true,
        observedAt: "2026-09-30T11:00",
        relativeHumidity: 70,
        temperature: 13,
        weatherCode: 2,
        windSpeed: 5,
      },
    });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const reading = await Effect.runPromise(loadCurrentWeather(location));
    expect(reading.weather.temperature).toBe(13);
    expect(reading.isStale).toBeFalsy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches forecasts, writes cache, and converts daytime data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(forecastPayload))
    );

    await expect(
      Effect.runPromise(loadCurrentWeather(location))
    ).resolves.toStrictEqual({
      isStale: false,
      weather: {
        apparentTemperature: 12,
        isDay: true,
        observedAt: "2026-09-30T12:00",
        relativeHumidity: 73,
        temperature: 14.3,
        weatherCode: 61,
        windSpeed: 8.1,
      },
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it("supports nighttime forecasts and auto timezone fallback", async () => {
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

    expect(reading.weather.isDay).toBeFalsy();
    expect(requestUrl(fetchMock.mock.calls[0]?.[0])).toContain("timezone=auto");
  });

  it("falls back to stale data for the same location after a request failure", async () => {
    const weather = {
      apparentTemperature: 1,
      isDay: false,
      observedAt: "2026-09-29T12:00",
      relativeHumidity: 80,
      temperature: 4,
      weatherCode: 3,
      windSpeed: 3,
    };

    seedWxtStorage("local:weather-cache", {
      fetchedAt: Date.now() - 60 * 60 * 1000,
      locationKey: "60.17,24.94",
      weather,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))
    );

    await expect(
      Effect.runPromise(loadCurrentWeather(location))
    ).resolves.toStrictEqual({
      isStale: true,
      weather,
    });
  });

  it("does not use another city's stale cache when the forecast fails", async () => {
    seedWxtStorage("local:weather-cache", {
      fetchedAt: Date.now() - 60 * 60 * 1000,
      locationKey: "0,0",
      weather: forecastPayload.current,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 500))
    );

    const result = await Effect.runPromise(
      Effect.either(loadCurrentWeather(location))
    );

    expect(Either.isLeft(result)).toBeTruthy();
  });

  it("continues when cache reads or writes fail", async () => {
    failWxtStorage("local:weather-cache", "read", new Error("read failed"));
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(forecastPayload))
    );
    await expect(
      Effect.runPromise(loadCurrentWeather(location))
    ).resolves.toMatchObject({
      isStale: false,
      weather: { temperature: 14.3 },
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

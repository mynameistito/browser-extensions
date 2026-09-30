import { Data, Effect, Either, Schema } from "effect";

import { storage } from "#imports";

import type { WeatherLocation } from "./preferences";
import {
  createForecastUrl,
  createGeocodingUrl,
  CityResponseSchema,
  CurrentWeatherSchema,
  parseCityResults,
  parseCurrentWeather,
  InvalidWeatherResponse,
} from "./weather";
import type { CityResult, CurrentWeather } from "./weather";

const WEATHER_CACHE_DURATION = 30 * 60 * 1000;

interface WeatherCache {
  readonly locationKey: string;
  readonly fetchedAt: number;
  readonly weather: CurrentWeather;
}

const weatherCacheItem = storage.defineItem<WeatherCache | null>(
  "local:weather-cache",
  { fallback: null, version: 1 }
);

/** Typed failure from a remote weather request or its local cache. */
export class WeatherRequestError extends Data.TaggedError(
  "WeatherRequestError"
)<{
  readonly operation: "geocoding" | "forecast" | "cache";
  readonly cause: unknown;
}> {}

/** A current reading and whether it is older than the normal refresh interval. */
export interface WeatherReading {
  readonly weather: CurrentWeather;
  readonly isStale: boolean;
}

const locationKey = (location: WeatherLocation): string =>
  `${location.latitude},${location.longitude}`;

const getJson = <S extends Schema.Schema.AnyNoContext>(
  url: URL,
  operation: "geocoding" | "forecast",
  schema: S
): Effect.Effect<
  Schema.Schema.Type<S>,
  WeatherRequestError | InvalidWeatherResponse
> =>
  Effect.gen(function* getJsonProgram() {
    const response = yield* Effect.tryPromise({
      try: () => fetch(url, { signal: AbortSignal.timeout(12_000) }),
      catch: (cause) => new WeatherRequestError({ operation, cause }),
    });

    if (!response.ok) {
      return yield* Effect.fail(
        new WeatherRequestError({
          operation,
          cause: new Error(
            `Weather provider returned HTTP ${response.status}.`
          ),
        })
      );
    }

    const payload = yield* Effect.tryPromise({
      try: async () => {
        const body: unknown = await response.json();
        return body;
      },
      catch: (cause) => new WeatherRequestError({ operation, cause }),
    });
    const decoded = Schema.decodeUnknownEither(schema)(payload);

    if (Either.isLeft(decoded)) {
      return yield* Effect.fail(
        new InvalidWeatherResponse({ endpoint: operation })
      );
    }

    return decoded.right;
  });

/** Look up global city matches using the city text entered by the user. */
export const searchCities = (
  query: string
): Effect.Effect<
  readonly CityResult[],
  WeatherRequestError | InvalidWeatherResponse
> => {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2) {
    return Effect.succeed([]);
  }

  return getJson(
    createGeocodingUrl(normalizedQuery),
    "geocoding",
    CityResponseSchema
  ).pipe(Effect.map(parseCityResults));
};

/** Fetch current conditions, reusing local data and falling back when offline. */
export const loadCurrentWeather = (
  location: WeatherLocation
): Effect.Effect<
  WeatherReading,
  WeatherRequestError | InvalidWeatherResponse
> =>
  Effect.gen(function* loadCurrentWeatherProgram() {
    const key = locationKey(location);
    const cacheResult = yield* Effect.either(
      Effect.tryPromise({
        try: () => weatherCacheItem.getValue(),
        catch: (cause) =>
          new WeatherRequestError({ operation: "cache", cause }),
      })
    );
    const cached = cacheResult._tag === "Right" ? cacheResult.right : null;
    const now = Date.now();

    if (
      cached?.locationKey === key &&
      now - cached.fetchedAt < WEATHER_CACHE_DURATION
    ) {
      return { weather: cached.weather, isStale: false };
    }

    const responseResult = yield* Effect.either(
      getJson(createForecastUrl(location), "forecast", CurrentWeatherSchema)
    );

    if (responseResult._tag === "Left") {
      if (cached?.locationKey === key) {
        return { weather: cached.weather, isStale: true };
      }

      return yield* Effect.fail(responseResult.left);
    }

    const parsed = parseCurrentWeather(responseResult.right);

    const nextCache: WeatherCache = {
      locationKey: key,
      fetchedAt: now,
      weather: parsed,
    };

    yield* Effect.either(
      Effect.tryPromise({
        try: () => weatherCacheItem.setValue(nextCache),
        catch: (cause) =>
          new WeatherRequestError({ operation: "cache", cause }),
      })
    );

    return { weather: parsed, isStale: false };
  });

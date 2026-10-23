import { Data, Schema } from "effect";

import type { WeatherLocation } from "./preferences";

/** A geocoded location option returned for a manually entered city. */
export type CityResult = WeatherLocation & {
  readonly id: number;
};

/** Normalized current weather for a location. */
export interface CurrentWeather {
  readonly temperature: number;
  readonly apparentTemperature: number;
  readonly relativeHumidity: number;
  readonly windSpeed: number;
  readonly weatherCode: number;
  readonly isDay: boolean;
  readonly observedAt: string;
}

/** Error describing malformed data returned by the weather provider. */
export class InvalidWeatherResponse extends Data.TaggedError(
  "InvalidWeatherResponse"
)<{
  readonly endpoint: "geocoding" | "forecast";
}> {}

const CityRecordSchema = Schema.Struct({
  admin1: Schema.optional(Schema.String),
  country: Schema.String,
  id: Schema.Number,
  latitude: Schema.Number.pipe(Schema.between(-90, 90)),
  longitude: Schema.Number.pipe(Schema.between(-180, 180)),
  name: Schema.String,
  timezone: Schema.String,
});

export const CityResponseSchema = Schema.Struct({
  results: Schema.optional(Schema.Array(CityRecordSchema)),
});

export const CurrentWeatherSchema = Schema.Struct({
  current: Schema.Struct({
    apparent_temperature: Schema.Number,
    is_day: Schema.Literal(0, 1),
    relative_humidity_2m: Schema.Number.pipe(
      Schema.int(),
      Schema.between(0, 100)
    ),
    temperature_2m: Schema.Number,
    time: Schema.String,
    weather_code: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    wind_speed_10m: Schema.Number.pipe(Schema.nonNegative()),
  }),
});

/**
 * Build the Open-Meteo city-search URL for a manually entered place.
 * @param query - City or place name to search for.
 * @returns The geocoding endpoint URL with the requested place.
 */
export const createGeocodingUrl = (query: string): URL => {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query.trim());
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  return url;
};

/**
 * Build an Open-Meteo current-weather URL for a selected location.
 * @param location - Selected coordinates and time zone.
 * @returns The forecast endpoint URL for the location.
 */
export const createForecastUrl = (location: WeatherLocation): URL => {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m"
  );
  url.searchParams.set("timezone", location.timezone || "auto");

  return url;
};

/**
 * Convert a decoded geocoding response into city options.
 * @param input - Validated geocoding response.
 * @returns City options suitable for the location picker.
 */
export const parseCityResults = (
  input: Schema.Schema.Type<typeof CityResponseSchema>
): readonly CityResult[] =>
  (input.results ?? []).map((item) => ({
    country: item.country,
    id: item.id,
    latitude: item.latitude,
    longitude: item.longitude,
    name: item.name,
    region: item.admin1 ?? "",
    timezone: item.timezone,
  }));

/**
 * Convert decoded current conditions into the dashboard weather model.
 * @param input - Validated current-conditions response.
 * @returns Normalized current weather for the dashboard.
 */
export const parseCurrentWeather = (
  input: Schema.Schema.Type<typeof CurrentWeatherSchema>
): CurrentWeather => {
  const { current } = input;

  return {
    apparentTemperature: current.apparent_temperature,
    isDay: current.is_day === 1,
    observedAt: current.time,
    relativeHumidity: current.relative_humidity_2m,
    temperature: current.temperature_2m,
    weatherCode: current.weather_code,
    windSpeed: current.wind_speed_10m,
  };
};

/**
 * Describe an Open-Meteo weather code in user-facing language.
 * @param code - Numeric code returned by Open-Meteo.
 * @returns A short weather description for display.
 */
export const describeWeatherCode = (code: number): string => {
  if (code === 0) {
    return "Clear sky";
  }

  if (code === 1) {
    return "Mostly clear";
  }

  if (code === 2) {
    return "Partly cloudy";
  }

  if (code === 3) {
    return "Overcast";
  }

  if (code === 45 || code === 48) {
    return "Fog";
  }

  if (code >= 51 && code <= 57) {
    return "Drizzle";
  }

  if (code >= 61 && code <= 67) {
    return "Rain";
  }

  if (code >= 71 && code <= 77) {
    return "Snow";
  }

  if (code >= 80 && code <= 82) {
    return "Rain showers";
  }

  if (code === 85 || code === 86) {
    return "Snow showers";
  }

  if (code === 95 || code === 96 || code === 99) {
    return "Thunderstorms";
  }

  return "Current conditions";
};

import { Schema } from "effect";

/** Supported web search providers. */
export type SearchProvider = "google" | "bing" | "duckduckgo";

/** Supported color theme preferences. */
type ThemePreference = "system" | "light" | "dark";

/** A manually selected weather location. */
export interface WeatherLocation {
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
}

/** User-editable preferences stored on this device. */
export interface Preferences {
  readonly searchProvider: SearchProvider;
  readonly theme: ThemePreference;
  readonly backgroundEnabled: boolean;
  readonly backgroundChangeNonce: number;
  readonly weatherLocation: WeatherLocation | null;
}

/** Safe initial values for a new installation. */
export const DEFAULT_PREFERENCES: Preferences = {
  searchProvider: "google",
  theme: "system",
  backgroundEnabled: true,
  backgroundChangeNonce: 0,
  weatherLocation: null,
};

const WeatherLocationSchema = Schema.Struct({
  name: Schema.String,
  region: Schema.String,
  country: Schema.String,
  latitude: Schema.Number.pipe(Schema.between(-90, 90)),
  longitude: Schema.Number.pipe(Schema.between(-180, 180)),
  timezone: Schema.String,
});

export const PreferencesSchema = Schema.Struct({
  searchProvider: Schema.Literal("google", "bing", "duckduckgo"),
  theme: Schema.Literal("system", "light", "dark"),
  backgroundEnabled: Schema.Boolean,
  backgroundChangeNonce: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  weatherLocation: Schema.NullOr(WeatherLocationSchema),
});

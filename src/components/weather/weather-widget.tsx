import { Effect } from "effect";
import type { Either } from "effect";
import { useEffect, useState } from "react";

import { usePreferences } from "@/components/preferences/preferences-provider";
import { describeWeatherCode } from "@/lib/weather";
import type { InvalidWeatherResponse } from "@/lib/weather";
import type { WeatherReading, WeatherRequestError } from "@/lib/weather-client";
import { loadCurrentWeather } from "@/lib/weather-client";

const WEATHER_REFRESH_INTERVAL = 30 * 60 * 1000;

const loadWeatherEffect = (
  location: NonNullable<
    ReturnType<typeof usePreferences>["preferences"]["weatherLocation"]
  >,
  onResult: (
    result: Either.Either<
      WeatherReading,
      WeatherRequestError | InvalidWeatherResponse
    >
  ) => void
) =>
  loadCurrentWeather(location).pipe(
    Effect.either,
    Effect.tap((result) => Effect.sync(() => onResult(result)))
  );

/** Show current weather for a city explicitly selected by the user. */
export const WeatherWidget = () => {
  const { preferences } = usePreferences();
  const location = preferences.weatherLocation;
  const [readingState, setReadingState] = useState<{
    readonly locationKey: string;
    readonly reading: WeatherReading;
  } | null>(null);
  const [errorLocationKey, setErrorLocationKey] = useState("");
  const currentLocationKey = location
    ? `${location.latitude},${location.longitude}`
    : "";
  const reading =
    readingState?.locationKey === currentLocationKey
      ? readingState.reading
      : null;
  const error = errorLocationKey === currentLocationKey;

  useEffect(() => {
    if (!location) {
      return;
    }

    let isMounted = true;
    let refreshTimer = 0;

    const refresh = () => {
      Effect.runFork(
        loadWeatherEffect(location, (result) => {
          if (!isMounted) {
            return;
          }

          if (result._tag === "Right") {
            setReadingState({
              locationKey: `${location.latitude},${location.longitude}`,
              reading: result.right,
            });
            setErrorLocationKey("");
          } else {
            setErrorLocationKey(`${location.latitude},${location.longitude}`);
          }

          refreshTimer = window.setTimeout(refresh, WEATHER_REFRESH_INTERVAL);
        })
      );
    };

    refresh();

    return () => {
      isMounted = false;
      window.clearTimeout(refreshTimer);
    };
  }, [location]);

  if (!location) {
    return (
      <section aria-label="Weather" className="weather-widget">
        <p className="widget-eyebrow">Weather</p>
        <p className="weather-empty">
          Set a city in Customize to see local weather.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Weather" className="weather-widget">
      <div className="weather-heading">
        <div>
          <p className="widget-eyebrow">Weather</p>
          <p className="weather-location">
            {location.name}
            {location.region ? `, ${location.region}` : ""}
          </p>
        </div>
        {reading ? (
          <span className="weather-temperature">
            {Math.round(reading.weather.temperature)}°
          </span>
        ) : (
          <span aria-hidden="true" className="weather-skeleton" />
        )}
      </div>
      {reading ? (
        <>
          <p className="weather-condition">
            {describeWeatherCode(reading.weather.weatherCode)}
            {reading.isStale ? " · saved reading" : ""}
          </p>
          <p className="weather-details">
            Feels like {Math.round(reading.weather.apparentTemperature)}°{" · "}
            Humidity {reading.weather.relativeHumidity}%
          </p>
        </>
      ) : (
        <p aria-live="polite" className="weather-condition">
          {error
            ? "Weather is unavailable right now."
            : "Getting current conditions…"}
        </p>
      )}
      <a
        className="weather-attribution"
        href="https://open-meteo.com/"
        rel="noreferrer"
        target="_blank"
      >
        Weather data by Open-Meteo
      </a>
    </section>
  );
};

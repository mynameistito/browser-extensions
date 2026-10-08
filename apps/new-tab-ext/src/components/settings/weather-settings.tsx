import { Effect } from "effect";
import { useState } from "react";

import { usePreferences } from "@/components/preferences/preferences-provider";
import type { CityResult } from "@/lib/weather";
import { searchCities } from "@/lib/weather-client";

const CITY_SEARCH_ERROR = "Could not find cities right now. Try again shortly.";

/** Edit the user's manually selected weather city. */
export const WeatherSettings = ({
  isLoaded,
}: {
  readonly isLoaded: boolean;
}) => {
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<readonly CityResult[]>([]);
  const [cityMessage, setCityMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const { preferences, updatePreferences } = usePreferences();

  const findCities = () => {
    setIsSearching(true);
    setCityMessage("");
    setCityResults([]);

    Effect.runFork(
      Effect.either(searchCities(cityQuery)).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            setIsSearching(false);

            if (result._tag === "Left") {
              setCityMessage(CITY_SEARCH_ERROR);
              return;
            }

            setCityResults(result.right);
            setCityMessage(
              result.right.length === 0
                ? "No matches. Check the spelling and try again."
                : ""
            );
          })
        )
      )
    );
  };

  return (
    <section
      aria-labelledby="weather-settings-title"
      className="settings-section"
    >
      <h2 id="weather-settings-title">Weather</h2>
      <p className="settings-description">
        Choose a city yourself. This extension never requests your device
        location.
      </p>
      {preferences.weatherLocation && (
        <div className="selected-city">
          <span>
            {preferences.weatherLocation.name}
            {preferences.weatherLocation.region
              ? `, ${preferences.weatherLocation.region}`
              : ""}
            {`, ${preferences.weatherLocation.country}`}
          </span>
          <button
            className="text-button"
            onClick={() =>
              updatePreferences((current) => ({
                ...current,
                weatherLocation: null,
              }))
            }
            type="button"
          >
            Remove
          </button>
        </div>
      )}
      <label className="field-label" htmlFor="city-query">
        City
      </label>
      <div className="inline-field">
        <input
          autoComplete="off"
          disabled={!isLoaded}
          id="city-query"
          onChange={(event) => setCityQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              findCities();
            }
          }}
          placeholder="Search by city name"
          value={cityQuery}
        />
        <button
          className="control-button"
          disabled={!isLoaded || isSearching || cityQuery.trim().length < 2}
          onClick={findCities}
          type="button"
        >
          {isSearching ? "Searching" : "Find"}
        </button>
      </div>
      {cityMessage && (
        <p aria-live="polite" className="form-message">
          {cityMessage}
        </p>
      )}
      {cityResults.length > 0 && (
        <ul aria-label="City matches" className="city-results">
          {cityResults.map((city) => (
            <li key={city.id}>
              <button
                className="city-result"
                onClick={() => {
                  updatePreferences((current) => ({
                    ...current,
                    weatherLocation: {
                      name: city.name,
                      region: city.region,
                      country: city.country,
                      latitude: city.latitude,
                      longitude: city.longitude,
                      timezone: city.timezone,
                    },
                  }));
                  setCityResults([]);
                  setCityQuery("");
                  setCityMessage("City saved on this device.");
                }}
                type="button"
              >
                <span>{city.name}</span>
                <span>
                  {[city.region, city.country].filter(Boolean).join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="provider-note">
        Weather data by Open-Meteo. City searches and selected coordinates are
        sent to Open-Meteo to retrieve weather.
      </p>
    </section>
  );
};

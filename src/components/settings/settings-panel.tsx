import { useEffect, useRef, useState } from "react";

import { usePreferences } from "../preferences/preferences-provider";
import { WeatherSettings } from "./weather-settings";

type SettingsSection = "appearance" | "search" | "weather" | "privacy";

const sections: readonly {
  readonly id: SettingsSection;
  readonly label: string;
}[] = [
  { id: "appearance", label: "Appearance" },
  { id: "search", label: "Search" },
  { id: "weather", label: "Weather" },
  { id: "privacy", label: "Privacy" },
];

/** Edit all dashboard preferences without leaving the new-tab page. */
export const SettingsPanel = ({
  open,
  onClose,
  onNextBackground,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onNextBackground: () => void;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [section, setSection] = useState<SettingsSection>("appearance");
  const { preferences, isLoaded, storageMessage, updatePreferences } =
    usePreferences();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby="settings-title"
      className="settings-dialog"
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="settings-shell">
        <header className="settings-header">
          <div>
            <p className="settings-kicker">Your new tab</p>
            <h1 id="settings-title">Customize</h1>
          </div>
          <button
            aria-label="Close customize settings"
            className="settings-close"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>

        <div className="settings-body">
          <nav aria-label="Customize sections" className="settings-nav">
            {sections.map((item) => (
              <button
                aria-current={section === item.id ? "page" : undefined}
                className={
                  section === item.id
                    ? "settings-nav-item is-active"
                    : "settings-nav-item"
                }
                key={item.id}
                onClick={() => setSection(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {section === "appearance" && (
              <section
                aria-labelledby="appearance-title"
                className="settings-section"
              >
                <h2 id="appearance-title">Appearance</h2>
                <p className="settings-description">
                  Set the mood for a fresh start.
                </p>

                <label className="field-label" htmlFor="theme-select">
                  Theme
                </label>
                <select
                  disabled={!isLoaded}
                  id="theme-select"
                  onChange={(event) => {
                    const theme = event.currentTarget.value;
                    if (
                      theme === "system" ||
                      theme === "light" ||
                      theme === "dark"
                    ) {
                      updatePreferences((current) => ({ ...current, theme }));
                    }
                  }}
                  value={preferences.theme}
                >
                  <option value="system">Match device</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>

                <div className="setting-row">
                  <div>
                    <p className="setting-title">Landscape backgrounds</p>
                    <p className="setting-hint">
                      Rotate through attributed Wikimedia photos daily.
                    </p>
                  </div>
                  <input
                    aria-label="Enable rotating backgrounds"
                    checked={preferences.backgroundEnabled}
                    disabled={!isLoaded}
                    onChange={(event) =>
                      updatePreferences((current) => ({
                        ...current,
                        backgroundEnabled: event.currentTarget.checked,
                      }))
                    }
                    type="checkbox"
                  />
                </div>
                <button
                  className="text-button"
                  onClick={onNextBackground}
                  type="button"
                >
                  Change background now
                </button>
              </section>
            )}

            {section === "search" && (
              <section
                aria-labelledby="search-settings-title"
                className="settings-section"
              >
                <h2 id="search-settings-title">Search</h2>
                <p className="settings-description">
                  Choose where web searches open. ChatGPT stays available as a
                  separate action.
                </p>
                <label className="field-label" htmlFor="search-provider">
                  Web search provider
                </label>
                <select
                  disabled={!isLoaded}
                  id="search-provider"
                  onChange={(event) => {
                    const searchProvider = event.currentTarget.value;
                    if (
                      searchProvider === "google" ||
                      searchProvider === "bing" ||
                      searchProvider === "duckduckgo"
                    ) {
                      updatePreferences((current) => ({
                        ...current,
                        searchProvider,
                      }));
                    }
                  }}
                  value={preferences.searchProvider}
                >
                  <option value="google">Google</option>
                  <option value="bing">Bing</option>
                  <option value="duckduckgo">DuckDuckGo</option>
                </select>
              </section>
            )}

            {section === "weather" && <WeatherSettings isLoaded={isLoaded} />}

            {section === "privacy" && (
              <section
                aria-labelledby="privacy-title"
                className="settings-section"
              >
                <h2 id="privacy-title">Privacy</h2>
                <p className="settings-description">
                  Your preferences stay in this browser profile.
                </p>
                <ul className="privacy-list">
                  <li>
                    Searches go directly to the provider you choose. ChatGPT
                    prompts open ChatGPT.
                  </li>
                  <li>
                    Weather is optional. Only a city search and the selected
                    coordinates are sent to Open-Meteo. No device location is
                    read.
                  </li>
                  <li>
                    Background images and their credits come from Wikimedia
                    Commons. Wikimedia receives the image request, not your
                    search or city.
                  </li>
                  <li>No account, analytics, or app backend is used.</li>
                </ul>
                <p className="provider-note">
                  Open-Meteo&apos;s free API is for non-commercial use. The
                  weather feature assumes this extension is free and
                  non-commercial.
                </p>
              </section>
            )}

            {storageMessage && (
              <p aria-live="polite" className="storage-message">
                {storageMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
};

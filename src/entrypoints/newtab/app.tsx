import { useEffect, useState } from "react";

import { BackgroundLayer } from "../../components/background/background-layer";
import { ClockWidget } from "../../components/clock/clock-widget";
import { usePreferences } from "../../components/preferences/preferences-provider";
import { SearchWidget } from "../../components/search/search-widget";
import { SettingsPanel } from "../../components/settings/settings-panel";
import { WeatherWidget } from "../../components/weather/weather-widget";

/** The initial new-tab dashboard with a clock and search actions. */
export const App = () => {
  const { preferences, isLoaded, updatePreferences } = usePreferences();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  const changeBackground = () => {
    updatePreferences((current) => ({
      ...current,
      backgroundEnabled: true,
      backgroundChangeNonce: current.backgroundChangeNonce + 1,
    }));
  };

  return (
    <main className="new-tab">
      <BackgroundLayer />
      <header className="topbar">
        <p className="wordmark">
          <span aria-hidden="true" className="wordmark-mark">
            n
          </span>
          <span>new tab</span>
        </p>
        <span className="local-note">Your space, on this device</span>
        <button
          aria-expanded={isSettingsOpen}
          aria-haspopup="dialog"
          className="customize-button"
          disabled={!isLoaded}
          onClick={() => setIsSettingsOpen(true)}
          type="button"
        >
          Customize
        </button>
      </header>

      <section aria-label="Dashboard" className="home-content">
        <div className="hero-widgets">
          <ClockWidget />
          <SearchWidget />
        </div>
        <div className="secondary-widgets">
          <WeatherWidget />
        </div>
      </section>

      <footer className="bottom-note">
        <span>Preferences are stored on this device.</span>
      </footer>

      <SettingsPanel
        onClose={() => setIsSettingsOpen(false)}
        onNextBackground={changeBackground}
        open={isSettingsOpen}
      />
    </main>
  );
};

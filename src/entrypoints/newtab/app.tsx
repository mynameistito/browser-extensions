import { ClockWidget } from "../../components/clock/clock-widget";
import { SearchWidget } from "../../components/search/search-widget";

/** The initial new-tab dashboard with a clock and search actions. */
export const App = () => (
  <main className="new-tab">
    <header className="topbar">
      <p className="wordmark">
        <span aria-hidden="true" className="wordmark-mark">
          n
        </span>
        <span>new tab</span>
      </p>
      <span className="local-note">Your space, on this device</span>
    </header>

    <section aria-label="Search and time" className="home-content">
      <ClockWidget />
      <SearchWidget />
    </section>

    <footer className="bottom-note">
      <span>Built for a quieter start</span>
    </footer>
  </main>
);

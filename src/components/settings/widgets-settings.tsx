import { usePreferences } from "@/components/preferences/preferences-provider";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import type { WidgetId } from "@/lib/preferences";

const widgetNames: Record<WidgetId, string> = {
  clock: "Clock",
  search: "Search",
  weather: "Weather",
};

/** Show or hide each widget and restore the starter layout. */
export const WidgetsSettings = ({
  isLoaded,
}: {
  readonly isLoaded: boolean;
}) => {
  const { preferences, updatePreferences } = usePreferences();

  const setWidgetVisibility = (id: WidgetId, visible: boolean) =>
    updatePreferences((current) => ({
      ...current,
      widgetLayout: current.widgetLayout.map((item) =>
        item.id === id ? { ...item, visible } : item
      ),
    }));

  return (
    <section
      aria-labelledby="widgets-settings-title"
      className="settings-section"
    >
      <h2 id="widgets-settings-title">Widgets</h2>
      <p className="settings-description">
        Choose what appears on your page. Use Arrange mode to move or resize
        visible widgets.
      </p>
      <div className="widget-visibility-list">
        {preferences.widgetLayout.map((placement) => (
          <label className="widget-visibility-row" key={placement.id}>
            <span>{widgetNames[placement.id]}</span>
            <input
              checked={placement.visible}
              disabled={!isLoaded}
              onChange={(event) =>
                setWidgetVisibility(placement.id, event.currentTarget.checked)
              }
              type="checkbox"
            />
          </label>
        ))}
      </div>
      <button
        className="text-button"
        disabled={!isLoaded}
        onClick={() =>
          updatePreferences((current) => ({
            ...current,
            widgetLayout: DEFAULT_PREFERENCES.widgetLayout,
          }))
        }
        type="button"
      >
        Reset widget layout
      </button>
    </section>
  );
};

import { useState } from "react";

import {
  moveWidget,
  resizeWidget,
  swapWidgetPositions,
} from "../../lib/preferences";
import type {
  WidgetId,
  WidgetPlacement,
  WidgetSpan,
} from "../../lib/preferences";
import { ClockWidget } from "../clock/clock-widget";
import { usePreferences } from "../preferences/preferences-provider";
import { SearchWidget } from "../search/search-widget";
import { WeatherWidget } from "../weather/weather-widget";

const widgetLabels: Record<WidgetId, string> = {
  clock: "Clock",
  search: "Search",
  weather: "Weather",
};

const widgetSpans: readonly {
  readonly value: WidgetSpan;
  readonly label: string;
  readonly controlLabel: string;
}[] = [
  { value: 1, label: "Narrow", controlLabel: "S" },
  { value: 2, label: "Medium", controlLabel: "M" },
  { value: 3, label: "Wide", controlLabel: "L" },
];

const renderWidget = (id: WidgetId) => {
  switch (id) {
    case "clock": {
      return <ClockWidget />;
    }
    case "search": {
      return <SearchWidget />;
    }
    case "weather": {
      return <WeatherWidget />;
    }
    default: {
      return null;
    }
  }
};

/** Render optional widgets with keyboard and pointer arrangement controls. */
export const WidgetGrid = ({
  isArrangeMode,
}: {
  readonly isArrangeMode: boolean;
}) => {
  const { preferences, updatePreferences } = usePreferences();
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null);
  const visibleWidgets = preferences.widgetLayout.filter(
    (placement) => placement.visible
  );

  const setLayout = (widgetLayout: readonly WidgetPlacement[]) =>
    updatePreferences((current) => ({ ...current, widgetLayout }));

  const setSpan = (id: WidgetId, span: WidgetSpan) =>
    setLayout(resizeWidget(preferences.widgetLayout, id, span));

  const moveEarlier = (id: WidgetId) =>
    setLayout(moveWidget(preferences.widgetLayout, id, -1));

  const moveLater = (id: WidgetId) =>
    setLayout(moveWidget(preferences.widgetLayout, id, 1));

  const dropWidget = (targetId: WidgetId) => {
    if (!draggingId) {
      return;
    }

    setLayout(
      swapWidgetPositions(preferences.widgetLayout, draggingId, targetId)
    );
    setDraggingId(null);
  };

  return (
    <ul aria-label="Widgets" className="widget-grid">
      {visibleWidgets.map((placement, index) => (
        <li
          aria-label={`${widgetLabels[placement.id]} widget`}
          className={
            draggingId === placement.id
              ? "widget-card is-dragging"
              : "widget-card"
          }
          data-arranging={isArrangeMode}
          data-span={placement.span}
          key={placement.id}
        >
          {isArrangeMode && (
            <div className="widget-arrange-bar">
              <button
                className="widget-arrange-title"
                draggable
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={() => setDraggingId(placement.id)}
                onDrop={(event) => {
                  event.preventDefault();
                  dropWidget(placement.id);
                }}
                type="button"
              >
                {widgetLabels[placement.id]}
              </button>
              <fieldset className="widget-span-controls">
                <legend className="sr-only">
                  {widgetLabels[placement.id]} size
                </legend>
                {widgetSpans.map((span) => (
                  <button
                    aria-label={`${span.label} width`}
                    aria-pressed={placement.span === span.value}
                    className="widget-tool-button"
                    key={span.value}
                    onClick={() => setSpan(placement.id, span.value)}
                    type="button"
                  >
                    {span.controlLabel}
                  </button>
                ))}
              </fieldset>
              <fieldset className="widget-move-controls">
                <legend className="sr-only">
                  Move {widgetLabels[placement.id]}
                </legend>
                <button
                  aria-label={`Move ${widgetLabels[placement.id]} earlier`}
                  className="widget-tool-button"
                  disabled={index === 0}
                  onClick={() => moveEarlier(placement.id)}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={`Move ${widgetLabels[placement.id]} later`}
                  className="widget-tool-button"
                  disabled={index === visibleWidgets.length - 1}
                  onClick={() => moveLater(placement.id)}
                  type="button"
                >
                  ↓
                </button>
              </fieldset>
            </div>
          )}
          <div className="widget-card-content">
            {renderWidget(placement.id)}
          </div>
        </li>
      ))}
      {visibleWidgets.length === 0 && (
        <li className="empty-widget-grid">
          No widgets are showing. Open Customize to add one.
        </li>
      )}
    </ul>
  );
};

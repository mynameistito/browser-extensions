import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, test, vi } from "vitest";

import { ClockWidget } from "../../src/components/clock/clock-widget";
import { usePreferences } from "../../src/components/preferences/preferences-provider";
import { SearchWidget } from "../../src/components/search/search-widget";
import { WidgetsSettings } from "../../src/components/settings/widgets-settings";
import { WeatherWidget } from "../../src/components/weather/weather-widget";
import { WidgetGrid } from "../../src/components/widgets/widget-grid";
import { DEFAULT_PREFERENCES } from "../../src/lib/preferences";
import type { WidgetPlacement } from "../../src/lib/preferences";
import { renderWithPreferences } from "../helpers/render-with-preferences";
import { seedWxtStorage } from "../helpers/wxt-imports";

const city = {
  name: "Helsinki",
  region: "Uusimaa",
  country: "Finland",
  latitude: 60.17,
  longitude: 24.94,
  timezone: "Europe/Helsinki",
};

const UnsupportedWidgetLayout = () => {
  const { updatePreferences } = usePreferences();

  useEffect(() => {
    // SAFETY: This deliberately bypasses the validated preferences schema to exercise the widget's defensive unknown-ID fallback.
    const unsupportedId = ["unsupported"][0] as WidgetPlacement["id"];
    const unsupportedPlacement = {
      id: unsupportedId,
      visible: true,
      span: 1,
    } satisfies WidgetPlacement;
    updatePreferences((current) => ({
      ...current,
      widgetLayout: [unsupportedPlacement],
    }));
  }, [updatePreferences]);

  return <WidgetGrid isArrangeMode={false} />;
};

describe("dashboard widgets", () => {
  test("clock updates once per second and clears its interval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    const view = renderWithPreferences(<ClockWidget />);
    const clock = view.container.querySelector("time");

    expect(clock?.dateTime).toBe("2026-09-30T12:00:00.000Z");
    act(() => vi.advanceTimersByTime(1000));
    expect(clock?.dateTime).toBe("2026-09-30T12:00:01.000Z");
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  test("hides weather by default and exposes an empty state when all widgets are hidden", async () => {
    const view = renderWithPreferences(<WidgetGrid isArrangeMode={false} />);
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(2)
    );
    expect(screen.queryByLabelText("Weather widget")).toBeNull();
    view.unmount();

    seedWxtStorage("local:preferences", {
      ...DEFAULT_PREFERENCES,
      widgetLayout: DEFAULT_PREFERENCES.widgetLayout.map((item) => ({
        ...item,
        visible: false,
      })),
    });
    renderWithPreferences(<WidgetGrid isArrangeMode={false} />);
    expect(
      await screen.findByText(
        "No widgets are showing. Open Customize to add one."
      )
    ).toBeTruthy();
  });

  test("renders an enabled weather widget through the grid", async () => {
    seedWxtStorage("local:preferences", {
      ...DEFAULT_PREFERENCES,
      widgetLayout: DEFAULT_PREFERENCES.widgetLayout.map((item) =>
        item.id === "weather" ? { ...item, visible: true } : item
      ),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))
    );
    renderWithPreferences(<WidgetGrid isArrangeMode={false} />);
    expect(await screen.findByLabelText("Weather widget")).toBeTruthy();
  });

  test("ignores an unknown widget ID supplied at runtime", async () => {
    renderWithPreferences(<UnsupportedWidgetLayout />);
    expect(await screen.findByRole("list", { name: "Widgets" })).toBeTruthy();
    expect(screen.queryByText("undefined widget")).toBeNull();
  });

  test("resizes, keyboard-reorders, and drag-swaps in Arrange mode", async () => {
    const user = userEvent.setup();
    renderWithPreferences(<WidgetGrid isArrangeMode />);
    await screen.findAllByRole("listitem");
    const clockCard = screen.getByRole("listitem", { name: "Clock widget" });
    const searchCard = screen.getByRole("listitem", { name: "Search widget" });

    expect(clockCard.dataset.arranging).toBe("true");
    expect(
      within(clockCard)
        .getByRole("button", { name: "Medium width" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    await user.click(
      within(clockCard).getByRole("button", {
        name: "Wide width",
      })
    );
    expect(screen.getAllByRole("listitem")[0]?.dataset.span).toBe("3");

    await user.click(
      within(clockCard).getByRole("button", {
        name: "Move Clock later",
      })
    );
    expect(screen.getAllByRole("listitem")[0]?.getAttribute("aria-label")).toBe(
      "Search widget"
    );

    await user.click(
      within(screen.getByRole("listitem", { name: "Clock widget" })).getByRole(
        "button",
        { name: "Move Clock earlier" }
      )
    );
    expect(screen.getAllByRole("listitem")[0]?.getAttribute("aria-label")).toBe(
      "Clock widget"
    );

    const currentClock = screen.getByText("Clock", { selector: "button" });
    const currentSearch = screen.getByText("Search", { selector: "button" });
    fireEvent.dragStart(currentClock);
    expect(currentClock.closest("li")?.className).toContain("is-dragging");
    fireEvent.dragOver(currentSearch);
    fireEvent.drop(currentSearch);
    expect(screen.getAllByRole("listitem")[0]?.getAttribute("aria-label")).toBe(
      "Search widget"
    );
    fireEvent.dragEnd(currentClock);
    expect(currentClock.closest("li")?.className).toBe("widget-card");

    fireEvent.drop(currentSearch);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(searchCard).toBeTruthy();
  });

  test("disables widget visibility controls before preferences load", () => {
    renderWithPreferences(<WidgetsSettings isLoaded={false} />);
    const weatherToggle = screen.getByRole("checkbox", { name: "Weather" });
    expect(weatherToggle).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", { name: "Reset widget layout" })
    ).toHaveProperty("disabled", true);
  });

  test("persists visibility changes and resets the starter layout", async () => {
    const user = userEvent.setup();
    renderWithPreferences(<WidgetsSettings isLoaded />);
    const weatherToggle = await screen.findByRole("checkbox", {
      name: "Weather",
    });
    await user.click(weatherToggle);
    expect(weatherToggle).toHaveProperty("checked", true);
    await user.click(
      screen.getByRole("button", { name: "Reset widget layout" })
    );
    expect(weatherToggle).toHaveProperty("checked", false);
  });

  test("submits web and ChatGPT searches and reports blank queries", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    seedWxtStorage("local:preferences", {
      ...DEFAULT_PREFERENCES,
      searchProvider: "duckduckgo",
    });
    renderWithPreferences(<SearchWidget />);

    const webButton = await screen.findByRole("button", { name: "Search web" });
    expect(screen.getByText("DuckDuckGo · ChatGPT prompt")).toBeTruthy();
    await user.click(webButton);
    expect(await screen.findByText("Enter a search first.")).toBeTruthy();

    const input = screen.getByRole("searchbox", {
      name: "Search the web or ask ChatGPT",
    });
    await user.type(input, "  weather today  ");
    await user.click(webButton);
    expect(open).toHaveBeenLastCalledWith(
      "https://duckduckgo.com/?q=weather+today",
      "_blank",
      "noopener,noreferrer"
    );

    await user.click(screen.getByRole("button", { name: "Ask ChatGPT" }));
    expect(open).toHaveBeenLastCalledWith(
      "https://chatgpt.com/?q=weather+today",
      "_blank",
      "noopener,noreferrer"
    );
    expect(screen.getByText("DuckDuckGo · ChatGPT prompt")).toBeTruthy();
  });

  test("shows the unconfigured weather prompt and selected-city conditions", async () => {
    const noCity = renderWithPreferences(<WeatherWidget />);
    expect(
      await screen.findByText("Set a city in Customize to see local weather.")
    ).toBeTruthy();
    noCity.unmount();

    seedWxtStorage("local:preferences", {
      ...DEFAULT_PREFERENCES,
      weatherLocation: city,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          current: {
            temperature_2m: 14.3,
            apparent_temperature: 12,
            relative_humidity_2m: 73,
            wind_speed_10m: 8.1,
            weather_code: 61,
            is_day: 1,
            time: "2026-09-30T12:00",
          },
        })
      )
    );
    renderWithPreferences(<WeatherWidget />);
    expect(await screen.findByText("Helsinki, Uusimaa")).toBeTruthy();
    expect(await screen.findByText("Rain")).toBeTruthy();
    expect(screen.getByText("Weather data by Open-Meteo")).toBeTruthy();
  });

  test("renders a location without a region", async () => {
    seedWxtStorage("local:preferences", {
      ...DEFAULT_PREFERENCES,
      weatherLocation: { ...city, region: "" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))
    );
    renderWithPreferences(<WeatherWidget />);
    expect(await screen.findByText("Helsinki")).toBeTruthy();
  });

  test("shows offline errors, stale readings, and cancels refresh timers", async () => {
    const clearTimeout = vi.spyOn(window, "clearTimeout");
    seedWxtStorage("local:preferences", {
      ...DEFAULT_PREFERENCES,
      weatherLocation: city,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({}, { status: 503 }))
    );
    const view = renderWithPreferences(<WeatherWidget />);
    expect(
      await screen.findByText("Weather is unavailable right now.")
    ).toBeTruthy();
    view.unmount();
    expect(clearTimeout).toHaveBeenCalled();

    seedWxtStorage("local:weather-cache", {
      locationKey: "60.17,24.94",
      fetchedAt: Date.now() - 60 * 60 * 1000,
      weather: {
        temperature: 8,
        apparentTemperature: 6,
        relativeHumidity: 80,
        windSpeed: 4,
        weatherCode: 2,
        isDay: true,
        observedAt: "2026-09-30T11:00",
      },
    });
    renderWithPreferences(<WeatherWidget />);
    expect(
      await screen.findByText("Partly cloudy · saved reading")
    ).toBeTruthy();
  });

  test("ignores a weather request that completes after widget unmount", async () => {
    const response = Promise.withResolvers<Response>();
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(response.promise);
    vi.stubGlobal("fetch", fetchMock);
    seedWxtStorage("local:preferences", {
      ...DEFAULT_PREFERENCES,
      weatherLocation: city,
    });
    const view = renderWithPreferences(<WeatherWidget />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    view.unmount();
    await act(async () => {
      response.resolve(
        Response.json({
          current: {
            temperature_2m: 14,
            apparent_temperature: 12,
            relative_humidity_2m: 70,
            wind_speed_10m: 5,
            weather_code: 1,
            is_day: 1,
            time: "2026-09-30T12:00",
          },
        })
      );
      await response.promise;
    });
  });
});

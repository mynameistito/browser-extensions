import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { PreferencesProvider } from "../../src/components/preferences/preferences-provider";
import { SettingsPanel } from "../../src/components/settings/settings-panel";
import { WeatherSettings } from "../../src/components/settings/weather-settings";
import { renderWithPreferences } from "../helpers/render-with-preferences";
import { failWxtStorage } from "../helpers/wxt-imports";

const cityResults = {
  results: [
    {
      id: 1,
      name: "Helsinki",
      admin1: "Uusimaa",
      country: "Finland",
      latitude: 60.17,
      longitude: 24.94,
      timezone: "Europe/Helsinki",
    },
    {
      id: 2,
      name: "Smalltown",
      country: "Finland",
      latitude: 61,
      longitude: 25,
      timezone: "Europe/Helsinki",
    },
  ],
};

describe("settings UI", () => {
  test("opens, navigates, updates settings, and closes the dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onNextBackground = vi.fn();
    const view = render(
      <PreferencesProvider>
        <SettingsPanel
          onClose={onClose}
          onNextBackground={onNextBackground}
          open={false}
        />
      </PreferencesProvider>
    );
    const dialog = view.container.querySelector("dialog");
    if (!dialog) {
      throw new Error("Settings dialog was not rendered.");
    }
    expect(dialog).toHaveProperty("open", false);

    view.rerender(
      <PreferencesProvider>
        <SettingsPanel
          onClose={onClose}
          onNextBackground={onNextBackground}
          open
        />
      </PreferencesProvider>
    );
    await waitFor(() => expect(dialog).toHaveProperty("open", true));

    fireEvent.change(screen.getByLabelText("Theme"), {
      target: { value: "light" },
    });
    expect(screen.getByLabelText("Theme")).toHaveProperty("value", "light");
    fireEvent.change(screen.getByLabelText("Theme"), {
      target: { value: "invalid" },
    });
    expect(screen.getByLabelText("Theme")).toHaveProperty("value", "light");

    const backgroundToggle = screen.getByRole("checkbox", {
      name: "Enable rotating backgrounds",
    });
    await user.click(backgroundToggle);
    expect(backgroundToggle).toHaveProperty("checked", false);
    await user.click(
      screen.getByRole("button", { name: "Change background now" })
    );
    expect(onNextBackground).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.change(screen.getByLabelText("Web search provider"), {
      target: { value: "bing" },
    });
    expect(screen.getByLabelText("Web search provider")).toHaveProperty(
      "value",
      "bing"
    );
    fireEvent.change(screen.getByLabelText("Web search provider"), {
      target: { value: "invalid" },
    });
    expect(screen.getByLabelText("Web search provider")).toHaveProperty(
      "value",
      "bing"
    );

    await user.click(screen.getByRole("button", { name: "Widgets" }));
    expect(
      screen.getByText(/Use Arrange mode to move or resize visible widgets\./u)
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Weather" }));
    expect(
      screen.getByText("Choose a city yourself.", { exact: false })
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Privacy" }));
    expect(
      screen.getByText("No account, analytics, or app backend is used.")
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Close customize settings" })
    );
    expect(onClose).toHaveBeenCalled();
    view.rerender(
      <PreferencesProvider>
        <SettingsPanel
          onClose={onClose}
          onNextBackground={onNextBackground}
          open={false}
        />
      </PreferencesProvider>
    );
    await waitFor(() => expect(dialog).toHaveProperty("open", false));
    fireEvent(dialog, new Event("close"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  test("shows storage errors inside Customize", async () => {
    failWxtStorage(
      "local:preferences",
      "read",
      new Error("storage unavailable")
    );
    renderWithPreferences(
      <SettingsPanel onClose={vi.fn()} onNextBackground={vi.fn()} open />
    );

    expect(
      await screen.findByText(
        "Settings could not be loaded. Defaults are shown."
      )
    ).toBeTruthy();
  });

  test("searches for and saves a city, then allows removal", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(cityResults))
        .mockResolvedValueOnce(Response.json(cityResults))
    );
    renderWithPreferences(<WeatherSettings isLoaded />);

    const findButton = screen.getByRole("button", { name: "Find" });
    expect(findButton).toHaveProperty("disabled", true);
    const input = screen.getByLabelText("City");
    await user.type(input, "Helsinki");
    expect(findButton).toHaveProperty("disabled", false);
    await user.keyboard("{Enter}");
    const matches = await screen.findByRole("list", { name: "City matches" });
    expect(matches.textContent).toContain("Helsinki");
    expect(matches.textContent).toContain("Smalltown");

    await user.click(screen.getByRole("button", { name: /Helsinki/u }));
    expect(await screen.findByText("City saved on this device.")).toBeTruthy();
    expect(screen.getByText("Helsinki, Uusimaa, Finland")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("Helsinki, Uusimaa, Finland")).toBeNull();

    fireEvent.change(input, { target: { value: "Smalltown" } });
    await user.click(screen.getByRole("button", { name: "Find" }));
    await user.click(await screen.findByRole("button", { name: /Smalltown/u }));
    expect(screen.getByText("Smalltown, Finland")).toBeTruthy();
  });

  test("shows no-match and provider-error messages for city searches", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ results: [] }))
    );
    renderWithPreferences(<WeatherSettings isLoaded />);
    await user.type(screen.getByLabelText("City"), "Missingville");
    await user.click(screen.getByRole("button", { name: "Find" }));
    expect(
      await screen.findByText("No matches. Check the spelling and try again.")
    ).toBeTruthy();

    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({}, { status: 500 }))
    );
    await user.click(screen.getByRole("button", { name: "Find" }));
    expect(
      await screen.findByText(
        "Could not find cities right now. Try again shortly."
      )
    ).toBeTruthy();
  });
});

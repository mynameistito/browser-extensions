import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, vi, it } from "vitest";

import { PreferencesProvider } from "../../src/components/preferences/preferences-provider";
import { SettingsPanel } from "../../src/components/settings/settings-panel";
import { WeatherSettings } from "../../src/components/settings/weather-settings";
import { renderWithPreferences } from "../helpers/render-with-preferences";
import {
  cleanupTestEnvironment,
  setupTestEnvironment,
} from "../helpers/test-environment";
import { failWxtStorage } from "../helpers/wxt-imports";

const cityResults = {
  results: [
    {
      admin1: "Uusimaa",
      country: "Finland",
      id: 1,
      latitude: 60.17,
      longitude: 24.94,
      name: "Helsinki",
      timezone: "Europe/Helsinki",
    },
    {
      country: "Finland",
      id: 2,
      latitude: 61,
      longitude: 25,
      name: "Smalltown",
      timezone: "Europe/Helsinki",
    },
  ],
};

describe("settings UI", () => {
  beforeEach(setupTestEnvironment);
  afterEach(cleanupTestEnvironment);

  it("opens and closes the customize dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn<() => void>();
    const onNextBackground = vi.fn<() => void>();

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
    await waitFor(() => {
      expect(dialog).toHaveProperty("open", true);
    });

    await user.click(
      screen.getByRole("button", { name: "Close customize settings" })
    );
    expect(onClose).toHaveBeenCalledOnce();
    view.rerender(
      <PreferencesProvider>
        <SettingsPanel
          onClose={onClose}
          onNextBackground={onNextBackground}
          open={false}
        />
      </PreferencesProvider>
    );
    await waitFor(() => {
      expect(dialog).toHaveProperty("open", false);
    });
    fireEvent(dialog, new Event("close"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("updates the theme and rotating background settings", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn<() => void>();
    const onNextBackground = vi.fn<() => void>();
    render(
      <PreferencesProvider>
        <SettingsPanel
          onClose={onClose}
          onNextBackground={onNextBackground}
          open
        />
      </PreferencesProvider>
    );

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
  });

  it("navigates between settings categories and validates the provider", async () => {
    const user = userEvent.setup();
    render(
      <PreferencesProvider>
        <SettingsPanel
          onClose={vi.fn<() => void>()}
          onNextBackground={vi.fn<() => void>()}
          open
        />
      </PreferencesProvider>
    );

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
  });

  it("shows storage errors inside Customize", async () => {
    failWxtStorage(
      "local:preferences",
      "read",
      new Error("storage unavailable")
    );
    renderWithPreferences(
      <SettingsPanel
        onClose={vi.fn<() => void>()}
        onNextBackground={vi.fn<() => void>()}
        open
      />
    );

    await expect(
      screen.findByText("Settings could not be loaded. Defaults are shown.")
    ).resolves.toBeTruthy();
  });

  it("searches for and saves a city, then allows removal", async () => {
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
    const input = screen.getByLabelText("City");
    await user.type(input, "Helsinki");
    expect(findButton).toHaveProperty("disabled", false);
    await user.keyboard("{Enter}");
    const matches = await screen.findByRole("list", { name: "City matches" });
    expect(matches.textContent ?? "").toMatch(/Helsinki.*Smalltown/su);

    await user.click(screen.getByRole("button", { name: /Helsinki/u }));
    await expect(
      screen.findByText("City saved on this device.")
    ).resolves.toBeTruthy();
    expect(screen.getByText("Helsinki, Uusimaa, Finland")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("Helsinki, Uusimaa, Finland")).toBeNull();
  });

  it("allows choosing a second city after removing the first", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(cityResults))
        .mockResolvedValueOnce(Response.json(cityResults))
    );
    renderWithPreferences(<WeatherSettings isLoaded />);

    const input = screen.getByLabelText("City");
    await user.type(input, "Helsinki");
    await user.click(screen.getByRole("button", { name: "Find" }));
    await user.click(await screen.findByRole("button", { name: /Helsinki/u }));
    await screen.findByText("City saved on this device.");
    await user.click(screen.getByRole("button", { name: "Remove" }));

    fireEvent.change(input, { target: { value: "Smalltown" } });
    await user.click(screen.getByRole("button", { name: "Find" }));
    await user.click(await screen.findByRole("button", { name: /Smalltown/u }));
    expect(screen.getByText("Smalltown, Finland")).toBeTruthy();
  });

  it("shows no-match and provider-error messages for city searches", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ results: [] }))
    );
    renderWithPreferences(<WeatherSettings isLoaded />);
    await user.type(screen.getByLabelText("City"), "Missingville");
    await user.click(screen.getByRole("button", { name: "Find" }));
    await expect(
      screen.findByText("No matches. Check the spelling and try again.")
    ).resolves.toBeTruthy();

    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({}, { status: 500 }))
    );
    await user.click(screen.getByRole("button", { name: "Find" }));
    await expect(
      screen.findByText("Could not find cities right now. Try again shortly.")
    ).resolves.toBeTruthy();
  });
});

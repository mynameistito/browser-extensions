import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, test } from "vitest";

import {
  PreferencesProvider,
  usePreferences,
} from "../../src/components/preferences/preferences-provider";
import { failWxtStorage } from "../helpers/wxt-imports";

const PreferencesProbe = () => {
  const { preferences, isLoaded, storageMessage, updatePreferences } =
    usePreferences();

  return (
    <div>
      <output aria-label="Loaded">{String(isLoaded)}</output>
      <output aria-label="Theme">{preferences.theme}</output>
      <output aria-label="Storage message">{storageMessage}</output>
      <button
        onClick={() =>
          updatePreferences((current) => ({
            ...current,
            theme: current.theme === "dark" ? "light" : "dark",
          }))
        }
        type="button"
      >
        Toggle theme
      </button>
    </div>
  );
};

describe("PreferencesProvider", () => {
  test("requires the provider for the preference hook", () => {
    expect(() => render(<PreferencesProbe />)).toThrow(
      "usePreferences must be used within PreferencesProvider."
    );
  });

  test("loads defaults and persists preference updates", async () => {
    render(
      <PreferencesProvider>
        <PreferencesProbe />
      </PreferencesProvider>
    );

    expect(screen.getByLabelText("Loaded").textContent).toBe("false");
    await waitFor(() =>
      expect(screen.getByLabelText("Loaded").textContent).toBe("true")
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Theme").textContent).toBe("dark")
    );
  });

  test("does not persist pre-load edits and drains queued updates in order", async () => {
    render(
      <PreferencesProvider>
        <PreferencesProbe />
      </PreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Loaded").textContent).toBe("true")
    );
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Theme").textContent).toBe("light")
    );
  });

  test("ignores load completion after unmount", async () => {
    const view = render(
      <PreferencesProvider>
        <PreferencesProbe />
      </PreferencesProvider>
    );

    view.unmount();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  test("reports load failures while still showing defaults", async () => {
    failWxtStorage(
      "local:preferences",
      "read",
      new Error("storage unavailable")
    );

    render(
      <PreferencesProvider>
        <PreferencesProbe />
      </PreferencesProvider>
    );

    expect(
      await screen.findByText(
        "Settings could not be loaded. Defaults are shown."
      )
    ).toBeTruthy();
    expect(screen.getByLabelText("Theme").textContent).toBe("system");
    expect(screen.getByLabelText("Loaded").textContent).toBe("true");
  });

  test("reports persistence failures", async () => {
    render(
      <PreferencesProvider>
        <PreferencesProbe />
      </PreferencesProvider>
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Loaded").textContent).toBe("true")
    );

    failWxtStorage("local:preferences", "write", new Error("disk full"));
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(
      await screen.findByText("This change could not be saved on this device.")
    ).toBeTruthy();
  });
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PreferencesProvider,
  usePreferences,
} from "../../src/components/preferences/preferences-provider";
import {
  cleanupTestEnvironment,
  setupTestEnvironment,
} from "../helpers/test-environment";
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
        onClick={() => {
          updatePreferences((current) => ({
            ...current,
            theme: current.theme === "dark" ? "light" : "dark",
          }));
        }}
        type="button"
      >
        Toggle theme
      </button>
    </div>
  );
};

describe(PreferencesProvider, () => {
  beforeEach(setupTestEnvironment);
  afterEach(cleanupTestEnvironment);

  it("requires the provider for the preference hook", () => {
    expect(() => render(<PreferencesProbe />)).toThrow(
      "usePreferences must be used within PreferencesProvider."
    );
  });

  it("loads defaults and persists preference updates", async () => {
    render(
      <PreferencesProvider>
        <PreferencesProbe />
      </PreferencesProvider>
    );

    expect(screen.getByLabelText("Loaded").textContent).toBe("false");
    await waitFor(() => {
      expect(screen.getByLabelText("Loaded").textContent).toBe("true");
    });

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Theme").textContent).toBe("dark");
    });
  });

  it("does not persist pre-load edits and drains queued updates in order", async () => {
    render(
      <PreferencesProvider>
        <PreferencesProbe />
      </PreferencesProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Loaded").textContent).toBe("true");
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Theme").textContent).toBe("light");
    });
  });

  it("ignores load completion after unmount", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

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

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("reports load failures while still showing defaults", async () => {
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

    await expect(
      screen.findByText("Settings could not be loaded. Defaults are shown.")
    ).resolves.toBeTruthy();
    expect(screen.getByLabelText("Theme").textContent).toBe("system");
    expect(screen.getByLabelText("Loaded").textContent).toBe("true");
  });

  it("reports persistence failures", async () => {
    render(
      <PreferencesProvider>
        <PreferencesProbe />
      </PreferencesProvider>
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Loaded").textContent).toBe("true");
    });

    failWxtStorage("local:preferences", "write", new Error("disk full"));
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    await expect(
      screen.findByText("This change could not be saved on this device.")
    ).resolves.toBeTruthy();
  });
});

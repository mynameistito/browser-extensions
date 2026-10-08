import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { BackgroundLayer } from "../../src/components/background/background-layer";
import { App } from "../../src/entrypoints/newtab/app";
import { DEFAULT_PREFERENCES } from "../../src/lib/preferences";
import { renderWithPreferences } from "../helpers/render-with-preferences";
import { seedWxtStorage } from "../helpers/wxt-imports";

const commonsPayload = {
  query: {
    pages: {
      "42": {
        title: "File:Mountain.jpg",
        imageinfo: [
          {
            thumburl: "https://thumb.wikimedia.org/mountain.jpg",
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:Mountain.jpg",
            extmetadata: {
              Artist: { value: "Photographer" },
              LicenseShortName: { value: "CC BY-SA 4.0" },
              LicenseUrl: {
                value: "https://creativecommons.org/licenses/by-sa/4.0/",
              },
            },
          },
        ],
      },
    },
  },
};

describe("new-tab app and background layer", () => {
  test("loads a Commons photo, shows source attribution, and falls back on image error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(commonsPayload))
    );
    const view = renderWithPreferences(<BackgroundLayer />);

    await waitFor(() =>
      expect(view.container.querySelector("img")).not.toBeNull()
    );
    const image = view.container.querySelector("img");
    if (!image) {
      throw new Error("Expected the loaded background image.");
    }
    expect(image.getAttribute("src")).toBe(
      "https://thumb.wikimedia.org/mountain.jpg"
    );
    expect(
      screen.getByRole("link", { name: "Mountain.jpg" }).getAttribute("href")
    ).toContain("commons.wikimedia.org");
    expect(
      screen.getByRole("link", { name: "CC BY-SA 4.0" }).getAttribute("href")
    ).toContain("creativecommons.org");
    fireEvent.error(image);
    await waitFor(() => expect(screen.queryByRole("img")).toBeNull());
  });

  test("does not fetch disabled backgrounds or display failed requests", async () => {
    seedWxtStorage("local:preferences", {
      ...DEFAULT_PREFERENCES,
      backgroundEnabled: false,
    });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    renderWithPreferences(<BackgroundLayer />);
    await waitFor(() => expect(screen.queryByRole("img")).toBeNull());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("keeps a local fallback when Wikimedia is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))
    );
    renderWithPreferences(<BackgroundLayer />);
    await waitFor(() => expect(screen.queryByRole("img")).toBeNull());
  });

  test("composes dashboard settings and arrange mode from the new-tab page", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))
    );
    renderWithPreferences(<App />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Arrange" })).toHaveProperty(
        "disabled",
        false
      )
    );
    expect(document.documentElement.dataset.theme).toBe("system");
    await user.click(screen.getByRole("button", { name: "Arrange" }));
    expect(
      screen
        .getByRole("button", { name: "Done arranging" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    await user.click(screen.getByRole("button", { name: "Done arranging" }));

    await user.click(screen.getByRole("button", { name: "Customize" }));
    expect(
      await screen.findByRole("heading", { name: "Appearance" })
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Change background now" })
    );
    await user.click(
      screen.getByRole("button", { name: "Close customize settings" })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

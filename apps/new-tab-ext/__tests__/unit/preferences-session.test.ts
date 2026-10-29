import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PREFERENCES } from "../../src/lib/preferences";
import { PreferencesSession } from "../../src/lib/preferences-session";
import {
  cleanupTestEnvironment,
  setupTestEnvironment,
} from "../helpers/test-environment";

describe("preferences session", () => {
  beforeEach(setupTestEnvironment);
  afterEach(cleanupTestEnvironment);

  it("ignores a load result after the session stops", async () => {
    const session = new PreferencesSession(
      Effect.succeed({ ...DEFAULT_PREFERENCES, theme: "dark" })
    );

    let notifications = 0;
    session.subscribe(() => {
      notifications += 1;
    });

    const stop = session.start();
    stop();
    await Promise.resolve();
    await Promise.resolve();

    expect(session.getSnapshot().isLoaded).toBeFalsy();
    expect(session.getSnapshot().preferences.theme).toBe("system");
    expect(notifications).toBe(0);
  });

  it("serializes saves and retains the latest failure message", async () => {
    const savedThemes: string[] = [];

    const session = new PreferencesSession(
      Effect.succeed(DEFAULT_PREFERENCES),
      (preferences) => {
        savedThemes.push(preferences.theme);

        return savedThemes.length === 1
          ? Effect.succeed(undefined)
          : Effect.fail(new Error("write failed"));
      }
    );

    session.start();
    await vi.waitFor(() => {
      expect(session.getSnapshot().isLoaded).toBeTruthy();
    });

    session.updatePreferences((current) => ({ ...current, theme: "dark" }));
    session.updatePreferences((current) => ({ ...current, theme: "light" }));

    expect(savedThemes).toStrictEqual(["dark"]);
    await vi.waitFor(() => {
      expect(savedThemes).toStrictEqual(["dark", "light"]);
      expect(session.getSnapshot().storageMessage).toBe(
        "This change could not be saved on this device."
      );
    });
  });
});

import { Effect, Either } from "effect";
import { describe, expect, test } from "vitest";

import { DEFAULT_PREFERENCES } from "../../src/lib/preferences";
import {
  loadPreferences,
  savePreferences,
} from "../../src/lib/preferences-storage";
import {
  clearWxtStorage,
  failWxtStorage,
  seedWxtStorage,
} from "../helpers/wxt-imports";

describe("local preferences storage", () => {
  test("returns defaults when storage has no saved value", async () => {
    await expect(Effect.runPromise(loadPreferences)).resolves.toEqual(
      DEFAULT_PREFERENCES
    );
  });

  test("uses defaults for malformed data and normalizes legacy layouts", async () => {
    seedWxtStorage("local:preferences", { invalid: true });
    await expect(Effect.runPromise(loadPreferences)).resolves.toEqual(
      DEFAULT_PREFERENCES
    );

    clearWxtStorage();
    seedWxtStorage("local:preferences", {
      searchProvider: "bing",
      theme: "dark",
      backgroundEnabled: true,
      backgroundChangeNonce: 3,
      weatherLocation: null,
    });

    const loaded = await Effect.runPromise(loadPreferences);
    expect(loaded.searchProvider).toBe("bing");
    expect(loaded.widgetLayout).toEqual(DEFAULT_PREFERENCES.widgetLayout);
  });

  test("preserves unique saved widgets and appends omitted defaults", async () => {
    seedWxtStorage("local:preferences", {
      ...DEFAULT_PREFERENCES,
      widgetLayout: [
        { id: "weather", visible: true, span: 1 },
        { id: "weather", visible: false, span: 2 },
      ],
    });

    const loaded = await Effect.runPromise(loadPreferences);
    expect(loaded.widgetLayout).toEqual([
      { id: "weather", visible: true, span: 1 },
      { id: "clock", visible: true, span: 2 },
      { id: "search", visible: true, span: 3 },
    ]);
  });

  test("retains read and write failures as typed storage errors", async () => {
    const readError = new Error("read failed");
    failWxtStorage("local:preferences", "read", readError);
    const readResult = await Effect.runPromise(Effect.either(loadPreferences));
    expect(Either.isLeft(readResult)).toBe(true);

    clearWxtStorage();
    failWxtStorage("local:preferences", "write", new Error("write failed"));
    const writeResult = await Effect.runPromise(
      Effect.either(savePreferences(DEFAULT_PREFERENCES))
    );
    expect(Either.isLeft(writeResult)).toBe(true);
  });

  test("persists a valid preference value", async () => {
    await expect(
      Effect.runPromise(savePreferences(DEFAULT_PREFERENCES))
    ).resolves.toBeUndefined();
    await expect(Effect.runPromise(loadPreferences)).resolves.toEqual(
      DEFAULT_PREFERENCES
    );
  });
});

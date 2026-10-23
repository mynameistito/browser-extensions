import { Effect, Either } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES } from "../../src/lib/preferences";
import {
  loadPreferences,
  savePreferences,
} from "../../src/lib/preferences-storage";
import {
  cleanupTestEnvironment,
  setupTestEnvironment,
} from "../helpers/test-environment";
import {
  clearWxtStorage,
  failWxtStorage,
  seedWxtStorage,
} from "../helpers/wxt-imports";

describe("local preferences storage", () => {
  beforeEach(setupTestEnvironment);
  afterEach(cleanupTestEnvironment);

  it("returns defaults when storage has no saved value", async () => {
    await expect(Effect.runPromise(loadPreferences)).resolves.toStrictEqual(
      DEFAULT_PREFERENCES
    );
  });

  it("uses defaults for malformed data and normalizes legacy layouts", async () => {
    seedWxtStorage("local:preferences", { invalid: true });
    await expect(Effect.runPromise(loadPreferences)).resolves.toStrictEqual(
      DEFAULT_PREFERENCES
    );

    clearWxtStorage();
    seedWxtStorage("local:preferences", {
      backgroundChangeNonce: 3,
      backgroundEnabled: true,
      searchProvider: "bing",
      theme: "dark",
      weatherLocation: null,
    });

    const loaded = await Effect.runPromise(loadPreferences);
    expect(loaded.searchProvider).toBe("bing");
    expect(loaded.widgetLayout).toStrictEqual(DEFAULT_PREFERENCES.widgetLayout);
  });

  it("preserves unique saved widgets and appends omitted defaults", async () => {
    seedWxtStorage("local:preferences", {
      ...DEFAULT_PREFERENCES,
      widgetLayout: [
        { id: "weather", span: 1, visible: true },
        { id: "weather", span: 2, visible: false },
      ],
    });

    const loaded = await Effect.runPromise(loadPreferences);
    expect(loaded.widgetLayout).toStrictEqual([
      { id: "weather", span: 1, visible: true },
      { id: "clock", span: 2, visible: true },
      { id: "search", span: 3, visible: true },
    ]);
  });

  it("retains read and write failures as typed storage errors", async () => {
    const readError = new Error("read failed");
    failWxtStorage("local:preferences", "read", readError);
    const readResult = await Effect.runPromise(Effect.either(loadPreferences));
    expect(Either.isLeft(readResult)).toBeTruthy();

    clearWxtStorage();
    failWxtStorage("local:preferences", "write", new Error("write failed"));

    const writeResult = await Effect.runPromise(
      Effect.either(savePreferences(DEFAULT_PREFERENCES))
    );

    expect(Either.isLeft(writeResult)).toBeTruthy();
  });

  it("persists a valid preference value", async () => {
    await expect(
      Effect.runPromise(savePreferences(DEFAULT_PREFERENCES))
    ).resolves.toBeUndefined();
    await expect(Effect.runPromise(loadPreferences)).resolves.toStrictEqual(
      DEFAULT_PREFERENCES
    );
  });
});

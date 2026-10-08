import { Data, Effect, Either, Schema } from "effect";

import { storage } from "#imports";

import {
  DEFAULT_PREFERENCES,
  normalizeWidgetLayout,
  PreferencesSchema,
} from "./preferences";
import type { Preferences } from "./preferences";

const preferencesItem = storage.defineItem<unknown>("local:preferences", {
  fallback: DEFAULT_PREFERENCES,
  version: 1,
});

/** A typed storage failure; the cause is retained for diagnostics. */
class PreferencesStorageError extends Data.TaggedError(
  "PreferencesStorageError"
)<{
  readonly operation: "read" | "write";
  readonly cause: unknown;
}> {}

/** Load locally saved preferences, falling back to safe defaults if malformed. */
export const loadPreferences = Effect.tryPromise({
  try: () => preferencesItem.getValue(),
  catch: (cause) => new PreferencesStorageError({ operation: "read", cause }),
}).pipe(
  Effect.map((stored) => {
    const parsed = Schema.decodeUnknownEither(PreferencesSchema)(stored);
    if (Either.isLeft(parsed)) {
      return DEFAULT_PREFERENCES;
    }

    return {
      ...parsed.right,
      widgetLayout: normalizeWidgetLayout(
        parsed.right.widgetLayout ?? DEFAULT_PREFERENCES.widgetLayout
      ),
    };
  })
);

/** Persist the current preference state to extension-local storage. */
export const savePreferences = (preferences: Preferences) =>
  Effect.tryPromise({
    try: () => preferencesItem.setValue(preferences),
    catch: (cause) =>
      new PreferencesStorageError({ operation: "write", cause }),
  });

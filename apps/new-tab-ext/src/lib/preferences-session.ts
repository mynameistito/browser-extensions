import { Effect, Exit } from "effect";

import { DEFAULT_PREFERENCES } from "./preferences";
import type { Preferences } from "./preferences";
import { loadPreferences, savePreferences } from "./preferences-storage";

/** Immutable preference state rendered by the React adapter. */
export interface PreferencesSnapshot {
  readonly preferences: Preferences;
  readonly isLoaded: boolean;
  readonly storageMessage: string;
}

const LOAD_ERROR_MESSAGE = "Settings could not be loaded. Defaults are shown.";
const SAVE_ERROR_MESSAGE = "This change could not be saved on this device.";

/**
 * Own the preference lifecycle independently from React: initial load, edits,
 * and ordered persistence all cross one observable state boundary.
 */
export class PreferencesSession {
  private snapshot: PreferencesSnapshot = {
    isLoaded: false,
    preferences: DEFAULT_PREFERENCES,
    storageMessage: "",
  };
  private preferencesRef = DEFAULT_PREFERENCES;
  private readonly listeners = new Set<() => void>();
  private readonly saveQueue: Preferences[] = [];
  private isSaving = false;
  private readonly loadEffect: Effect.Effect<Preferences, unknown>;
  private readonly saveEffect: (
    preferences: Preferences
  ) => Effect.Effect<void, unknown>;

  /**
   * @param loadEffect - Effect that reads and parses locally saved preferences.
   * @param saveEffect - Effect that persists one preference snapshot.
   */
  constructor(
    loadEffect: Effect.Effect<Preferences, unknown> = loadPreferences,
    saveEffect: (
      preferences: Preferences
    ) => Effect.Effect<void, unknown> = savePreferences
  ) {
    this.loadEffect = loadEffect;
    this.saveEffect = saveEffect;
  }

  readonly getSnapshot = (): PreferencesSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Begin loading and return a cleanup that ignores a late load result.
   * @returns Cleanup that deactivates this load attempt.
   */
  readonly start = (): (() => void) => {
    let isActive = true;
    void this.load(() => isActive);

    return () => {
      isActive = false;
    };
  };

  /**
   * Apply a local edit immediately and queue persistence after initial load.
   * @param update - Pure preference transformation.
   */
  readonly updatePreferences = (
    update: (current: Preferences) => Preferences
  ): void => {
    const next = update(this.preferencesRef);
    this.preferencesRef = next;
    this.publish({ preferences: next });

    if (!this.snapshot.isLoaded) {
      return;
    }

    this.saveQueue.push(next);
    void this.persistNext();
  };

  private async load(isStillActive: () => boolean) {
    const exit = await Effect.runPromiseExit(Effect.result(this.loadEffect));

    if (!isStillActive()) {
      return;
    }

    if (Exit.isFailure(exit) || exit.value._tag === "Failure") {
      this.publish({ isLoaded: true, storageMessage: LOAD_ERROR_MESSAGE });

      return;
    }

    this.preferencesRef = exit.value.success;
    this.publish({ isLoaded: true, preferences: exit.value.success });
  }

  private async persistNext(): Promise<void> {
    if (this.isSaving || this.saveQueue.length === 0) {
      return;
    }

    this.isSaving = true;
    const preferences = this.saveQueue.shift();

    if (preferences === undefined) {
      this.isSaving = false;

      return;
    }

    const exit = await Effect.runPromiseExit(
      Effect.result(this.saveEffect(preferences))
    );

    this.publish({
      storageMessage:
        Exit.isFailure(exit) || exit.value._tag === "Failure"
          ? SAVE_ERROR_MESSAGE
          : "",
    });
    this.isSaving = false;

    if (this.saveQueue.length > 0) {
      void this.persistNext();
    }
  }

  private publish(update: Partial<PreferencesSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...update };

    for (const listener of this.listeners) {
      listener();
    }
  }
}

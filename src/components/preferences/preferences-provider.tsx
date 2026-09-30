import { Effect, Exit } from "effect";
import {
  createContext,
  useMemo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import type { Preferences } from "@/lib/preferences";
import { loadPreferences, savePreferences } from "@/lib/preferences-storage";

interface PreferencesContextValue {
  readonly preferences: Preferences;
  readonly isLoaded: boolean;
  readonly storageMessage: string;
  readonly updatePreferences: (
    update: (current: Preferences) => Preferences
  ) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const LOAD_ERROR_MESSAGE = "Settings could not be loaded. Defaults are shown.";
const SAVE_ERROR_MESSAGE = "This change could not be saved on this device.";

/** Load and persist local settings around the new-tab application. */
export const PreferencesProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const preferencesRef = useRef(DEFAULT_PREFERENCES);
  const saveQueue = useRef<Preferences[]>([]);
  const isSaving = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const exit = await Effect.runPromiseExit(Effect.either(loadPreferences));

      if (!isMounted) {
        return;
      }

      if (Exit.isFailure(exit) || exit.value._tag === "Left") {
        setStorageMessage(LOAD_ERROR_MESSAGE);
      } else {
        preferencesRef.current = exit.value.right;
        setPreferences(exit.value.right);
      }

      setIsLoaded(true);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const updatePreferences = useCallback(
    (update: (current: Preferences) => Preferences) => {
      const next = update(preferencesRef.current);
      preferencesRef.current = next;
      setPreferences(next);

      if (!isLoaded) {
        return;
      }

      saveQueue.current.push(next);

      const persistNext: () => Promise<void> = async () => {
        if (isSaving.current || saveQueue.current.length === 0) {
          return;
        }

        isSaving.current = true;
        // SAFETY: The guard above verified the queue is non-empty; no code mutates it before this synchronous shift.
        const queuedPreferences = saveQueue.current.shift() as Preferences;
        const exit = await Effect.runPromiseExit(
          Effect.either(savePreferences(queuedPreferences))
        );

        setStorageMessage(
          Exit.isFailure(exit) || exit.value._tag === "Left"
            ? SAVE_ERROR_MESSAGE
            : ""
        );
        isSaving.current = false;

        if (saveQueue.current.length > 0) {
          void persistNext();
        }
      };

      void persistNext();
    },
    [isLoaded]
  );

  const contextValue = useMemo(
    () => ({ preferences, isLoaded, storageMessage, updatePreferences }),
    [preferences, isLoaded, storageMessage, updatePreferences]
  );

  return (
    <PreferencesContext.Provider value={contextValue}>
      {children}
    </PreferencesContext.Provider>
  );
};

/** Read and update the current device's new-tab preferences. */
export const usePreferences = (): PreferencesContextValue => {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider.");
  }

  return context;
};

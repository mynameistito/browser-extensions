import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import type { Preferences } from "@/lib/preferences";
import { PreferencesSession } from "@/lib/preferences-session";

interface PreferencesContextValue {
  readonly preferences: Preferences;
  readonly isLoaded: boolean;
  readonly storageMessage: string;
  readonly updatePreferences: (
    update: (current: Preferences) => Preferences
  ) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Load and persist local settings around the new-tab application.
 * @param props - Child elements that need access to preferences.
 * @returns A provider for current preferences and update actions.
 */
export const PreferencesProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const session = useMemo(() => new PreferencesSession(), []);

  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot
  );

  useEffect(() => session.start(), [session]);

  const value = useMemo(
    () => ({ ...snapshot, updatePreferences: session.updatePreferences }),
    [session, snapshot]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

/**
 * Read and update the current device's new-tab preferences.
 * @returns The preferences context value.
 */
export const usePreferences = (): PreferencesContextValue => {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider.");
  }

  return context;
};

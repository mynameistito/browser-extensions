import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import { PreferencesProvider } from "../../src/components/preferences/preferences-provider";

export const renderWithPreferences = (element: ReactNode) =>
  render(<PreferencesProvider>{element}</PreferencesProvider>);

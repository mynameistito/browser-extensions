import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import { PreferencesProvider } from "../../src/components/preferences/preferences-provider";

/** Renders a component tree with the preferences provider.
 * @param element - The child tree to render.
 * @returns The testing-library render result.
 */
export const renderWithPreferences = (element: ReactNode) =>
  render(<PreferencesProvider>{element}</PreferencesProvider>);

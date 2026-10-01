import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { PreferencesProvider } from "@/components/preferences/preferences-provider";

import { App } from "./app";
import { requireNewTabRoot } from "./root";

import "./style.css";

if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
  void import("react-grab");
}

const root = requireNewTabRoot(document.querySelector<HTMLDivElement>("#root"));

createRoot(root).render(
  <StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </StrictMode>
);

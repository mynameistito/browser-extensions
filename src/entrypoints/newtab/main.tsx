import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { PreferencesProvider } from "../../components/preferences/preferences-provider";
import { App } from "./app";

import "./style.css";

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("The new-tab root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </StrictMode>
);

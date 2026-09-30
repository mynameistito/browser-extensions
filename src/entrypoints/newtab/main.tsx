import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { PreferencesProvider } from "@/components/preferences/preferences-provider";

import { App } from "./app";
import { requireNewTabRoot } from "./root";

import "./style.css";

const root = requireNewTabRoot(document.querySelector<HTMLDivElement>("#root"));

createRoot(root).render(
  <StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </StrictMode>
);

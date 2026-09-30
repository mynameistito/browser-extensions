import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app";

import "./style.css";

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("The new-tab root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);

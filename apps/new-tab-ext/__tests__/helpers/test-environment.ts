import { cleanup } from "@testing-library/react";
import { vi } from "vitest";

import { clearWxtStorage } from "./wxt-imports";

/** Install browser API behavior required by the new-tab UI tests. */
export const setupTestEnvironment = (): void => {
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(
    function showModal(this: HTMLDialogElement) {
      this.open = true;
    }
  );
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(
    function close(this: HTMLDialogElement) {
      if (!this.open) {
        return;
      }

      this.open = false;
      this.dispatchEvent(new Event("close"));
    }
  );
};

/** Release shared DOM, storage, mock, environment, and timer state. */
export const cleanupTestEnvironment = (): void => {
  cleanup();
  clearWxtStorage();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
};

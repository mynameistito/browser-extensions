import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, vi } from "vitest";

import { clearWxtStorage } from "./helpers/wxt-imports";

describe("test environment", () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    cleanup();
    clearWxtStorage();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
});

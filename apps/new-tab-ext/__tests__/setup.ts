import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, vi } from "vitest";

import { clearWxtStorage } from "./helpers/wxt-imports";

afterEach(() => {
  cleanup();
  clearWxtStorage();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
};

HTMLDialogElement.prototype.close = function close() {
  if (!this.open) {
    return;
  }

  this.open = false;
  this.dispatchEvent(new Event("close"));
};

afterAll(() => {
  HTMLDialogElement.prototype.showModal = originalShowModal;
  HTMLDialogElement.prototype.close = originalClose;
});

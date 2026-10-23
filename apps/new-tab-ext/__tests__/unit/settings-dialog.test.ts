import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { syncSettingsDialog } from "../../src/lib/settings-dialog";
import {
  cleanupTestEnvironment,
  setupTestEnvironment,
} from "../helpers/test-environment";

describe("settings dialog synchronization", () => {
  beforeEach(setupTestEnvironment);
  afterEach(cleanupTestEnvironment);

  it("does nothing when the dialog ref is not attached", () => {
    expect(() => {
      syncSettingsDialog(null, true);
    }).not.toThrow();
  });

  it("opens a closed dialog and leaves an open dialog untouched", () => {
    const dialog = document.createElement("dialog");
    syncSettingsDialog(dialog, true);
    expect(dialog.open).toBeTruthy();

    syncSettingsDialog(dialog, true);
    expect(dialog.open).toBeTruthy();
  });

  it("closes an open dialog and leaves a closed dialog untouched", () => {
    const dialog = document.createElement("dialog");
    syncSettingsDialog(dialog, false);
    expect(dialog.open).toBeFalsy();

    dialog.showModal();
    syncSettingsDialog(dialog, false);
    expect(dialog.open).toBeFalsy();
  });
});

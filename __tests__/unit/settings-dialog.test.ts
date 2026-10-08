import { describe, expect, test } from "vitest";

import { syncSettingsDialog } from "../../src/lib/settings-dialog";

describe("settings dialog synchronization", () => {
  test("does nothing when the dialog ref is not attached", () => {
    expect(() => syncSettingsDialog(null, true)).not.toThrow();
  });

  test("opens a closed dialog and leaves an open dialog untouched", () => {
    const dialog = document.createElement("dialog");
    syncSettingsDialog(dialog, true);
    expect(dialog.open).toBe(true);

    syncSettingsDialog(dialog, true);
    expect(dialog.open).toBe(true);
  });

  test("closes an open dialog and leaves a closed dialog untouched", () => {
    const dialog = document.createElement("dialog");
    syncSettingsDialog(dialog, false);
    expect(dialog.open).toBe(false);

    dialog.showModal();
    syncSettingsDialog(dialog, false);
    expect(dialog.open).toBe(false);
  });
});

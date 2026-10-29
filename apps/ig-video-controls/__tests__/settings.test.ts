import { describe, expect, it, vi } from "vitest";

import {
  loadSettings,
  persistSettings,
  saveSettings,
  subscribeToSettings,
} from "@/entrypoints/content/settings";
import { DEFAULTS } from "@/lib/defaults";

import { setupTestEnvironment } from "./test-helpers";

describe("ig-video-controls", () => {
  const { addStorageListener, removeStorageListener, storageGet, storageSet } =
    setupTestEnvironment();

  describe("settings storage", () => {
    it("loads, saves, persists best-effort, and notifies only for relevant changes", async () => {
      await expect(loadSettings()).resolves.toStrictEqual(DEFAULTS);
      await saveSettings({ volumeLevel: 0.4 });
      expect(storageSet).toHaveBeenCalledWith({
        volumeLevel: 0.4,
      });
      persistSettings({ volumeLevel: 0.3 });
      await Promise.resolve();
      const handler = vi.fn<(settings: typeof DEFAULTS) => void>();
      const unsubscribe = subscribeToSettings(handler);
      expect(addStorageListener).toHaveBeenCalledOnce();

      const listener = addStorageListener.mock.calls[0]?.[0];

      if (!listener) {
        throw new TypeError("Expected the storage change listener");
      }

      listener({ unrelated: {} }, "local");
      await Promise.resolve();
      expect(handler).not.toHaveBeenCalled();
      listener({ volumeLevel: {} }, "local");
      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith(DEFAULTS);
      });
      unsubscribe();
      expect(removeStorageListener).toHaveBeenCalledOnce();
    });

    it("ignores storage read and write failures", async () => {
      storageGet.mockRejectedValueOnce(new Error("unavailable"));
      await expect(loadSettings()).rejects.toThrow("unavailable");
      storageSet.mockRejectedValueOnce(new Error("closed"));
      persistSettings({ volumeLevel: 0.2 });
      await Promise.resolve();
      await Promise.resolve();

      const unsubscribe = subscribeToSettings(
        vi.fn<(settings: typeof DEFAULTS) => void>()
      );

      storageGet.mockRejectedValueOnce(new Error("closed"));

      const listener = addStorageListener.mock.calls.at(-1)?.[0];

      if (!listener) {
        throw new TypeError("Expected the storage change listener");
      }

      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      listener({ playbackRate: {} }, "local");
      await Promise.resolve();
      await Promise.resolve();
      expect(error).toHaveBeenCalledOnce();
      unsubscribe();
    });

    it("supports multiple subscribers without duplicating the storage listener", () => {
      const first = vi.fn<(settings: typeof DEFAULTS) => void>();
      const second = vi.fn<(settings: typeof DEFAULTS) => void>();
      const unsubscribeFirst = subscribeToSettings(first);
      const unsubscribeSecond = subscribeToSettings(second);

      expect(addStorageListener).toHaveBeenCalledOnce();
      unsubscribeFirst();
      expect(removeStorageListener).not.toHaveBeenCalled();
      unsubscribeSecond();
      expect(removeStorageListener).toHaveBeenCalledOnce();
    });
  });
});

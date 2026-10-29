import { describe, expect, it, vi } from "vitest";

import { initializeSettings } from "@/entrypoints/background";
import { initializeContentScript } from "@/entrypoints/content";
import { DEFAULTS } from "@/lib/defaults";

import { setupTestEnvironment, settings } from "./test-helpers";

describe("ig-video-controls", () => {
  const { addStorageListener, storageGet, storageSet } = setupTestEnvironment();

  describe("extension entrypoints", () => {
    it("initializes missing background settings while preserving stored overrides", async () => {
      storageGet.mockResolvedValueOnce({
        volumeLevel: 0.3,
      });
      await initializeSettings();
      await Promise.resolve();
      await Promise.resolve();
      expect(storageGet).toHaveBeenCalledWith(Object.keys(DEFAULTS));
      await vi.waitFor(() => {
        expect(storageSet).toHaveBeenCalledWith({
          ...DEFAULTS,
          volumeLevel: 0.3,
        });
      });
    });

    it("boots the content script and responds to dynamic videos and settings", async () => {
      vi.useFakeTimers();

      const raf = vi.fn<(callback: FrameRequestCallback) => number>();

      vi.stubGlobal("requestAnimationFrame", raf);
      await initializeContentScript();

      const dynamicVideoRoot = document.createElement("div");
      dynamicVideoRoot.className = "EmbedVideo";
      const dynamicVideo = document.createElement("video");
      dynamicVideoRoot.append(dynamicVideo);
      const standaloneVideo = document.createElement("video");
      document.body.append(
        standaloneVideo,
        dynamicVideoRoot,
        document.createTextNode("ignored")
      );
      await vi.waitFor(() => {
        expect(raf).toHaveBeenCalledOnce();
      });
      const animationFrame = raf.mock.calls[0]?.[0];

      if (!animationFrame) {
        throw new TypeError("Expected a queued animation frame");
      }

      animationFrame(0);
      expect(dynamicVideo.dataset.igvcInit).toBe("1");

      const changed = {
        ...settings(),
        playbackRate: 2,
        volumeLevel: 0.25,
      };

      storageGet.mockResolvedValueOnce(changed);

      const settingsListener = addStorageListener.mock.calls[0]?.[0];

      if (!settingsListener) {
        throw new TypeError("Expected the storage change listener");
      }

      settingsListener({ playbackRate: {}, volumeLevel: {} });
      await Promise.resolve();
      await Promise.resolve();
      expect([dynamicVideo.volume, dynamicVideo.playbackRate]).toStrictEqual([
        0.25, 2,
      ]);

      const disabled = {
        ...changed,
        playbackRate: 3,
        rememberPlaybackRate: false,
        rememberVolumeLevel: false,
        volumeLevel: 0.75,
      };

      storageGet.mockResolvedValueOnce(disabled);
      settingsListener({ playbackRate: {}, volumeLevel: {} });
      await Promise.resolve();
      await Promise.resolve();
      expect([dynamicVideo.volume, dynamicVideo.playbackRate]).toStrictEqual([
        0.25, 2,
      ]);

      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      vi.advanceTimersByTime(5000);
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(5000);
    });
  });
});

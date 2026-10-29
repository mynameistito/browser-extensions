import { describe, expect, it, vi } from "vitest";

import { setSettings } from "@/entrypoints/content/video-controls";
import { showSpeedOsd, showVolumeOsd } from "@/entrypoints/content/video-osd";
import {
  initWheelHotkeys,
  updateWheelSettings,
} from "@/entrypoints/content/wheel-hotkeys";

import {
  setupTestEnvironment,
  makeVideo,
  requireHtmlElement,
  settings,
} from "./test-helpers";

describe("ig-video-controls", () => {
  const { storageSet } = setupTestEnvironment();

  describe("video OSD and wheel controls", () => {
    it("reuses, repositions, refreshes and hides the OSD", () => {
      vi.useFakeTimers();
      const video = makeVideo();
      showVolumeOsd(video, 0.456);
      const osd = requireHtmlElement(document.querySelector(".igvc-osd"));
      const observed: (string | null)[] = [osd.textContent, osd.style.opacity];
      showSpeedOsd(video, 1.5);
      observed.push(
        String(document.querySelectorAll(".igvc-osd").length),
        osd.textContent
      );
      vi.advanceTimersByTime(500);
      observed.push(osd.style.opacity);
      osd.remove();
      showVolumeOsd(video, 0);
      observed.push(String(document.querySelectorAll(".igvc-osd").length));
      document.querySelector(".igvc-osd-value")?.remove();
      showVolumeOsd(video, 0.25);
      observed.push(document.querySelector(".igvc-osd")?.textContent ?? null);
      expect(observed).toStrictEqual(["46%", "1", "1", "1.50x", "0", "1", ""]);
    });

    it("adjusts rate and right-button volume, clamps values, and cleans listeners", () => {
      const video = makeVideo();
      video.dataset.igvcInit = "1";
      const nestedRoot = document.createElement("div");
      const nestedVideo = makeVideo(nestedRoot);
      nestedVideo.dataset.igvcInit = "1";
      const nestedTarget = document.createElement("span");
      nestedRoot.append(nestedTarget);
      document.body.append(nestedRoot);
      nestedTarget.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: -1 })
      );
      const initial = settings();
      setSettings(initial);
      const cleanup = initWheelHotkeys(initial);
      document.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
      video.volume = 1;
      video.muted = true;
      video.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: -1 })
      );
      const observed: unknown[] = [video.volume, video.muted];
      video.volume = 0.5;
      video.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: 1 })
      );
      observed.push(Number(video.volume.toFixed(1)));
      document.dispatchEvent(
        new MouseEvent("contextmenu", { cancelable: true })
      );
      document.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
      video.playbackRate = 1;

      const speedWheel = new WheelEvent("wheel", {
        bubbles: true,
        deltaY: -1,
      });

      Object.defineProperty(speedWheel, "ctrlKey", { value: true });
      video.dispatchEvent(speedWheel);
      observed.push(storageSet.mock.calls.at(-1)?.[0], video.playbackRate);
      updateWheelSettings({ ...initial, playbackRateAdjustmentStepSize: 0.5 });
      cleanup();
      video.playbackRate = 1;
      video.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, ctrlKey: true, deltaY: -1 })
      );
      observed.push(video.playbackRate);
      expect(observed).toStrictEqual([
        1,
        false,
        0.9,
        { playbackRate: 1.25 },
        1.25,
        1,
      ]);
    });

    it("ignores wheel targets without initialized videos and cancels used context menus", () => {
      const video = makeVideo();
      video.dataset.igvcInit = "1";
      video.remove();
      const initial = settings();
      const cleanup = initWheelHotkeys(initial);

      document.dispatchEvent(new WheelEvent("wheel", { deltaY: 1 }));
      const unusualTarget = document.createElement("div");
      Object.defineProperty(unusualTarget, "matches", { value: () => true });
      document.body.append(unusualTarget);
      unusualTarget.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: 1 })
      );
      const falseVideoMatch = document.createElement("section");
      Object.defineProperty(falseVideoMatch, "querySelector", {
        value: () => document.createElement("div"),
      });
      document.body.append(falseVideoMatch);
      falseVideoMatch.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: 1 })
      );
      document.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
      document.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
      document.body.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: 1 })
      );
      expect(storageSet).not.toHaveBeenCalled();
      document.body.append(video);

      document.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
      video.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: -1 })
      );
      expect(storageSet).not.toHaveBeenCalled();
      document.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
      video.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: 1 })
      );
      const contextMenu = new MouseEvent("contextmenu", { cancelable: true });
      document.dispatchEvent(contextMenu);
      expect(contextMenu.defaultPrevented).toBeTruthy();

      const untouchedContextMenu = new MouseEvent("contextmenu", {
        cancelable: true,
      });

      document.dispatchEvent(untouchedContextMenu);
      expect(untouchedContextMenu.defaultPrevented).toBeFalsy();
      const reverseRate = new WheelEvent("wheel", { bubbles: true, deltaY: 1 });
      Object.defineProperty(reverseRate, "ctrlKey", { value: true });
      video.dispatchEvent(reverseRate);
      expect(video.playbackRate).toBe(0.75);
      document.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
      cleanup();
    });
  });
});

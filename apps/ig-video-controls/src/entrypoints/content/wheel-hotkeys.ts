import { clamp, snapToStep } from "@/lib/math";

import type { Settings } from "./settings";
import { showVolumeOsd, showSpeedOsd } from "./video-osd";

let rmbHeld = false;
let rmbUsedWheel = false;
let currentSettings: Settings;

const findVideoNearTarget = (target: Element): HTMLVideoElement | null => {
  if (target.matches("video[data-igvc-init]")) {
    return target as HTMLVideoElement;
  }
  let current: Element | null = target;
  for (let i = 0; i < 12 && current; i += 1) {
    const video = current.querySelector("video[data-igvc-init]");
    if (video) {
      return video as HTMLVideoElement;
    }
    current = current.parentElement;
  }
  return null;
};

const onMouseDown = (e: MouseEvent): void => {
  if (e.button === 2) {
    rmbHeld = true;
  }
};

const onMouseUp = (e: MouseEvent): void => {
  if (e.button === 2) {
    rmbHeld = false;
  }
};

const onContextMenu = (e: MouseEvent): void => {
  if (rmbUsedWheel) {
    e.preventDefault();
    rmbUsedWheel = false;
  }
};

const onWheel = (e: WheelEvent): void => {
  const { target } = e;
  if (!(target instanceof Element)) {
    return;
  }

  const video = findVideoNearTarget(target);
  if (!video) {
    return;
  }

  if (e.ctrlKey) {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    const baseRate = video.playbackRate;
    const newRate = clamp(
      snapToStep(
        baseRate + direction * currentSettings.playbackRateAdjustmentStepSize,
        currentSettings.playbackRateAdjustmentStepSize
      ),
      0.0625,
      128
    );
    browser.storage.local.set({ playbackRate: newRate });
    currentSettings.playbackRate = newRate;
    video.playbackRate = newRate;
    showSpeedOsd(video, newRate);
  } else if (rmbHeld) {
    e.preventDefault();
    rmbUsedWheel = true;
    const direction = e.deltaY > 0 ? -1 : 1;
    const newVolume = clamp(
      currentSettings.volumeLevel +
        direction * currentSettings.volumeAdjustmentStepSize,
      0,
      1
    );
    if (video.muted) {
      video.muted = false;
    }
    browser.storage.local.set({ volumeLevel: newVolume });
    currentSettings.volumeLevel = newVolume;
    video.volume = newVolume;
    showVolumeOsd(video, newVolume);
  }
};

export const initWheelHotkeys = (settings: Settings): (() => void) => {
  currentSettings = settings;

  document.addEventListener("mousedown", onMouseDown, { capture: true });
  document.addEventListener("mouseup", onMouseUp, { capture: true });
  document.addEventListener("contextmenu", onContextMenu, {
    capture: true,
  });
  document.addEventListener("wheel", onWheel, {
    capture: true,
    passive: false,
  });

  return () => {
    document.removeEventListener("mousedown", onMouseDown, { capture: true });
    document.removeEventListener("mouseup", onMouseUp, { capture: true });
    document.removeEventListener("contextmenu", onContextMenu, {
      capture: true,
    });
    document.removeEventListener("wheel", onWheel, { capture: true });
  };
};

export const updateWheelSettings = (settings: Settings): void => {
  currentSettings = settings;
};

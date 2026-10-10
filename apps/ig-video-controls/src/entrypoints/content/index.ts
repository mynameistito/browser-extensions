import { defineContentScript } from "#imports";

import { hideAllIgVolumeControls } from "./overlay-fixes";
import { loadSettings, subscribeToSettings } from "./settings";
import {
  setSettings,
  modifyAllPresentVideos,
  modifyVideo as modifyVideoImpl,
  setVolumeIfChanged,
  setPlaybackRateIfChanged,
  getKnownVideoElements,
  redefineWebkitMediaControlHidingCssRule,
} from "./video-controls";
import { initWheelHotkeys, updateWheelSettings } from "./wheel-hotkeys";

export default defineContentScript({
  allFrames: true,
  cssInjectionMode: "manifest",
  async main() {
    const settings = await loadSettings();
    setSettings(settings);

    const _cleanupWheel = initWheelHotkeys(settings);

    let prevSettings = settings;

    subscribeToSettings((newSettings) => {
      updateWheelSettings(newSettings);
      setSettings(newSettings);

      if (
        newSettings.rememberVolumeLevel &&
        newSettings.volumeLevel !== prevSettings.volumeLevel
      ) {
        for (const video of getKnownVideoElements()) {
          setVolumeIfChanged(video, newSettings.volumeLevel);
        }
      }
      if (
        newSettings.rememberPlaybackRate &&
        newSettings.playbackRate !== prevSettings.playbackRate
      ) {
        for (const video of getKnownVideoElements()) {
          setPlaybackRateIfChanged(video, newSettings.playbackRate);
        }
      }

      prevSettings = newSettings;
    });

    modifyAllPresentVideos();
    redefineWebkitMediaControlHidingCssRule();

    const observer = new MutationObserver((mutations) => {
      const videos: HTMLVideoElement[] = [];

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if ((node as Element).tagName === "VIDEO") {
            videos.push(node as HTMLVideoElement);
          }
          if (node instanceof Element && node.querySelectorAll) {
            const vids = node.querySelectorAll("video");
            if (vids.length) {
              videos.push(...([...vids] as HTMLVideoElement[]));
            }
          }
        }
      }

      if (videos.length) {
        requestAnimationFrame(() => {
          for (const video of videos) {
            modifyVideoImpl(video);
          }
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(() => {
      modifyAllPresentVideos();
      redefineWebkitMediaControlHidingCssRule();
      hideAllIgVolumeControls();
    }, 1000);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        modifyAllPresentVideos();
        redefineWebkitMediaControlHidingCssRule();
      }
    });
  },
  matches: ["https://*.instagram.com/*"],
  runAt: "document_end",
});

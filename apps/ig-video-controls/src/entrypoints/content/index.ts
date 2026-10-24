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

    initWheelHotkeys(settings);

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
          if (node instanceof HTMLVideoElement) {
            videos.push(node);
          }

          if (node instanceof Element) {
            const nestedVideos = [...node.querySelectorAll("video")].filter(
              (element): element is HTMLVideoElement =>
                element instanceof HTMLVideoElement
            );

            videos.push(...nestedVideos);
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
      if (document.hidden) {
        return;
      }

      modifyAllPresentVideos();
      redefineWebkitMediaControlHidingCssRule();
      hideAllIgVolumeControls();
    }, 5000);

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

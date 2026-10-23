import { valuesAreDifferentEnough } from "@/lib/math";

import {
  isInstagramStoriesPage,
  getEstimatedVideoComponentRootElement,
  nthParent,
  findIgMuteButton,
  isIgMuted,
} from "./button-finder";
import { queryAll, debounce } from "./dom";
import {
  modifyOverlayWithInstagramPlayControl,
  incapacitateStoryVideoPausingOverlays,
  modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls,
} from "./overlay-fixes";
import type { Settings } from "./settings";
import { persistSettings } from "./settings";

const knownVideoElements = new Set<HTMLVideoElement>();
let currentSettings: Settings;

/**
 * Return the video elements currently tracked by the extension.
 * @returns The live set of tracked video elements.
 */
export const getKnownVideoElements = (): Set<HTMLVideoElement> =>
  knownVideoElements;

/**
 * Replace the settings used to initialize and update video controls.
 * @param settings - Current user settings.
 */
export const setSettings = (settings: Settings): void => {
  currentSettings = settings;
};

const videoControlsAlreadyInitialized = (
  videoPlayer: HTMLVideoElement
): boolean => videoPlayer.dataset.igvcInit === "1";

/** Ensure WebKit native controls remain visible when video controls are on. */
export const redefineWebkitMediaControlHidingCssRule = (): void => {
  const id = "igvc-native-controls";

  const css =
    "video[data-igvc-init][controls]::-webkit-media-controls { display: flex; }";

  if (!document.querySelector(`#${id}`)) {
    const styleElement = document.createElement("style");
    styleElement.id = id;
    styleElement.append(document.createTextNode(css));
    document.head.append(styleElement);
  }
};

/**
 * Set the video volume when it differs from the requested value.
 * @param player - Video element to update.
 * @param newVolume - Requested volume between zero and one.
 */
export const setVolumeIfChanged = (
  player: HTMLVideoElement,
  newVolume: number
): void => {
  if (
    !Number.isNaN(newVolume) &&
    valuesAreDifferentEnough(player.volume, newVolume)
  ) {
    try {
      player.volume = newVolume;
    } catch {
      // likely out of range
    }
  }
};

/**
 * Set the video playback rate when it differs from the requested value.
 * @param player - Video element to update.
 * @param newPlaybackRate - Requested playback rate.
 */
export const setPlaybackRateIfChanged = (
  player: HTMLVideoElement,
  newPlaybackRate: number
): void => {
  if (
    !Number.isNaN(newPlaybackRate) &&
    valuesAreDifferentEnough(player.playbackRate, newPlaybackRate)
  ) {
    try {
      player.playbackRate = newPlaybackRate;
    } catch {
      // likely out of range
    }
  }
};

const setVolumeOfPreviouslySeenVideoElements = (volume: number): void => {
  for (const video of knownVideoElements) {
    setVolumeIfChanged(video, volume);
  }
};

const setPlaybackRateOfPreviouslySeenVideoElements = (
  playbackRate: number
): void => {
  for (const video of knownVideoElements) {
    setPlaybackRateIfChanged(video, playbackRate);
  }
};

const syncMuteStateWithIg = (videoPlayer: HTMLVideoElement): void => {
  const muteBtn = findIgMuteButton(videoPlayer);

  if (!muteBtn) {
    return;
  }

  const igMuted = isIgMuted(muteBtn);

  if (igMuted === undefined) {
    return;
  }

  if (videoPlayer.muted !== igMuted && muteBtn instanceof HTMLElement) {
    muteBtn.click();
  }
};

const handleVolumeChange = (videoPlayer: HTMLVideoElement) => {
  if (
    videoPlayer.dataset.igvcInitializing === undefined &&
    currentSettings.rememberVolumeLevel &&
    valuesAreDifferentEnough(currentSettings.volumeLevel, videoPlayer.volume)
  ) {
    currentSettings.volumeLevel = videoPlayer.volume;
    persistSettings({ volumeLevel: videoPlayer.volume });
    setVolumeOfPreviouslySeenVideoElements(videoPlayer.volume);
  }

  syncMuteStateWithIg(videoPlayer);
};

const handleRateChange = (videoPlayer: HTMLVideoElement) => {
  if (videoPlayer.dataset.igvcInitializing !== undefined) {
    return;
  }

  if (
    currentSettings.rememberPlaybackRate &&
    valuesAreDifferentEnough(
      currentSettings.playbackRate,
      videoPlayer.playbackRate
    )
  ) {
    currentSettings.playbackRate = videoPlayer.playbackRate;
    persistSettings({ playbackRate: videoPlayer.playbackRate });
    setPlaybackRateOfPreviouslySeenVideoElements(videoPlayer.playbackRate);
  }
};

const removeInitFlag = (videoPlayer: HTMLVideoElement): void => {
  setTimeout(() => {
    delete videoPlayer.dataset.igvcInitializing;
  }, 2000);
};

const applyPersistedSettings = (videoPlayer: HTMLVideoElement): void => {
  videoPlayer.dataset.igvcInitializing = "1";

  if (currentSettings.rememberVolumeLevel) {
    setVolumeIfChanged(videoPlayer, currentSettings.volumeLevel);
  }

  if (currentSettings.rememberPlaybackRate) {
    setPlaybackRateIfChanged(videoPlayer, currentSettings.playbackRate);
  }

  removeInitFlag(videoPlayer);
};

const modifyVideoElement = (embedRootElem: Element): void => {
  const videos = queryAll("video", embedRootElem).filter(
    (element): element is HTMLVideoElement =>
      element instanceof HTMLVideoElement
  );

  for (const videoPlayer of videos) {
    if (videoControlsAlreadyInitialized(videoPlayer)) {
      continue;
    }

    videoPlayer.dataset.igvcInit = "1";
    knownVideoElements.add(videoPlayer);

    videoPlayer.controls = true;
    videoPlayer.setAttribute("controlslist", "");

    if (isInstagramStoriesPage()) {
      incapacitateStoryVideoPausingOverlays(videoPlayer);
    }

    videoPlayer.addEventListener(
      "volumechange",
      debounce(() => {
        handleVolumeChange(videoPlayer);
      }, 200)
    );

    videoPlayer.addEventListener(
      "ratechange",
      debounce(() => {
        handleRateChange(videoPlayer);
      }, 200)
    );

    applyPersistedSettings(videoPlayer);

    redefineWebkitMediaControlHidingCssRule();

    if (isInstagramStoriesPage()) {
      modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
        videoPlayer
      );
      setTimeout(() => {
        modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
          videoPlayer
        );
      }, 300);
      setTimeout(() => {
        modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
          videoPlayer
        );
      }, 600);
      setTimeout(() => {
        modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
          videoPlayer
        );
      }, 1500);
    }
  }
};

/**
 * Find and initialize the video player's controls and overlays.
 * @param video - Video element to initialize.
 */
export const modifyVideo = (video: HTMLVideoElement): void => {
  if (videoControlsAlreadyInitialized(video)) {
    return;
  }

  let componentRoot: Element | null = video.closest(".EmbedVideo");

  componentRoot ??= getEstimatedVideoComponentRootElement(video) ?? null;

  componentRoot ??= nthParent(video, 4);

  if (componentRoot) {
    modifyVideoElement(componentRoot);
    modifyOverlayWithInstagramPlayControl(componentRoot, video);
  }
};

/** Remove detached videos and apply the current settings to connected videos. */
export const modifyAllPresentVideos = (): void => {
  for (const video of knownVideoElements) {
    if (!video.isConnected) {
      knownVideoElements.delete(video);
    }
  }

  for (const video of queryAll("video")) {
    if (video instanceof HTMLVideoElement) {
      modifyVideo(video);
    }
  }

  for (const video of knownVideoElements) {
    if (currentSettings.rememberVolumeLevel) {
      setVolumeIfChanged(video, currentSettings.volumeLevel);
    }

    if (currentSettings.rememberPlaybackRate) {
      setPlaybackRateIfChanged(video, currentSettings.playbackRate);
    }
  }
};

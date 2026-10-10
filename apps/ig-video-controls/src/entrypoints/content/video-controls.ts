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

const knownVideoElements = new Set<HTMLVideoElement>();
let currentSettings: Settings;

export const getKnownVideoElements = (): Set<HTMLVideoElement> =>
  knownVideoElements;

export const setSettings = (settings: Settings): void => {
  currentSettings = settings;
};

const videoControlsAlreadyInitialized = (
  videoPlayer: HTMLVideoElement
): boolean => videoPlayer.dataset.igvcInit === "1";

const redefineWebkitMediaControlHidingCssRule = (): void => {
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

export const setVolumeIfChanged = (
  player: HTMLVideoElement,
  newVolume: number
): void => {
  if (
    player &&
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

export const setPlaybackRateIfChanged = (
  player: HTMLVideoElement,
  newPlaybackRate: number
): void => {
  if (
    player &&
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

  if (videoPlayer.muted !== igMuted) {
    (muteBtn as HTMLElement).click();
  }
};

const handleVolumeChange = (videoPlayer: HTMLVideoElement) => {
  if (
    !videoPlayer.dataset.igvcInitializing &&
    currentSettings.rememberVolumeLevel &&
    valuesAreDifferentEnough(currentSettings.volumeLevel, videoPlayer.volume)
  ) {
    setVolumeOfPreviouslySeenVideoElements(videoPlayer.volume);
  }

  syncMuteStateWithIg(videoPlayer);
};

const handleRateChange = (videoPlayer: HTMLVideoElement) => {
  if (videoPlayer.dataset.igvcInitializing) {
    return;
  }
  if (
    currentSettings.rememberPlaybackRate &&
    valuesAreDifferentEnough(
      currentSettings.playbackRate,
      videoPlayer.playbackRate
    )
  ) {
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
  const videos = queryAll("video", embedRootElem) as HTMLVideoElement[];

  for (const videoPlayer of videos) {
    if (videoControlsAlreadyInitialized(videoPlayer)) {
      continue;
    }

    videoPlayer.dataset.igvcInit = "1";
    knownVideoElements.add(videoPlayer);

    videoPlayer.controls = true;
    videoPlayer.setAttribute("controlsList", "");

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
      setTimeout(
        () =>
          modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
            videoPlayer
          ),
        300
      );
      setTimeout(
        () =>
          modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
            videoPlayer
          ),
        600
      );
      setTimeout(
        () =>
          modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
            videoPlayer
          ),
        1500
      );
    }
  }
};

export const modifyVideo = (video: HTMLVideoElement): void => {
  if (videoControlsAlreadyInitialized(video)) {
    return;
  }

  let componentRoot: Element | null = video.closest(".EmbedVideo");
  if (!componentRoot) {
    componentRoot = getEstimatedVideoComponentRootElement(video) ?? null;
  }

  if (!componentRoot) {
    componentRoot = nthParent(video, 4);
  }

  if (componentRoot) {
    modifyVideoElement(componentRoot);
    modifyOverlayWithInstagramPlayControl(componentRoot, video);
  }
};

export const modifyAllPresentVideos = (): void => {
  for (const video of knownVideoElements) {
    if (!video.isConnected) {
      knownVideoElements.delete(video);
    }
  }
  for (const video of queryAll("video")) {
    modifyVideo(video as HTMLVideoElement);
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

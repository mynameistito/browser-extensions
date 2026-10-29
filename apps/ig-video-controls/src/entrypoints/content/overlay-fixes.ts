import {
  isInstagramReelsPage,
  findVolumeOrTagsButtons,
  getVideoCoveringButtons,
  looksLikeCoversVideo,
  nParents,
} from "./button-finder";
import { queryAll, hide } from "./dom";

export {
  incapacitateStoryVideoPausingOverlays,
  modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls,
} from "./story-layout";

const HTML5_CONTROL_HEIGHT = "70px";

const findPlayButton = (
  root: Element,
  vid: HTMLVideoElement
): Element | undefined => {
  const byLabel = root.querySelector("[role=button][aria-label=Play]");

  if (byLabel) {
    return byLabel;
  }

  return [...root.querySelectorAll("[role=button][aria-label]")].find((el) => {
    const rect = el.getBoundingClientRect();
    const parentEl = el.parentElement;

    if (!parentEl) {
      return false;
    }

    const parentRect = parentEl.getBoundingClientRect();

    if (
      rect.width >= 80 &&
      rect.height >= 80 &&
      rect.width < parentRect.width * 0.8 &&
      rect.height < parentRect.height * 0.8
    ) {
      return looksLikeCoversVideo(parentEl, vid);
    }

    return false;
  });
};

const findControlButton = (
  root: Element,
  vid: HTMLVideoElement
): Element | undefined => {
  const byLabel = root.querySelector("[role=button][aria-label=Control]");

  if (byLabel) {
    return byLabel;
  }

  return getVideoCoveringButtons(root, vid)[0];
};

const adjustVisualCompletionOverlay = (
  divVisualCompletion: Element,
  heightOfHtml5Controls: string
): void => {
  const divPresentation = divVisualCompletion.querySelector(
    "div[role=presentation]"
  );

  if (!divPresentation) {
    return;
  }

  if (divVisualCompletion instanceof HTMLElement) {
    divVisualCompletion.style.setProperty("bottom", heightOfHtml5Controls);
    divVisualCompletion.style.setProperty(
      "height",
      `calc(100% - ${heightOfHtml5Controls})`
    );
  }

  if (!isInstagramReelsPage() && divPresentation instanceof HTMLElement) {
    divPresentation.style.setProperty("bottom", heightOfHtml5Controls);
  }
};

const hideIgVolumeControl = (root: Element): void => {
  const slider = root.querySelector('[aria-label="Adjust volume"]');

  if (!slider?.parentElement) {
    return;
  }

  const wrapper = slider.parentElement;
  wrapper.style.setProperty("visibility", "hidden", "important");
  wrapper.style.setProperty("pointer-events", "none", "important");
};

/** Hide every Instagram volume control found in the current document. */
export const hideAllIgVolumeControls = (): void => {
  for (const slider of document.querySelectorAll(
    '[data-instancekey] [aria-label="Adjust volume"]'
  )) {
    const instanceKey = slider.closest("[data-instancekey]");

    if (instanceKey) {
      hideIgVolumeControl(instanceKey);
    }
  }
};

const handleInstanceKeyOverlay = (
  divInstanceKey: Element,
  embedRootElem: Element,
  video: HTMLVideoElement,
  heightOfHtml5Controls: string
): void => {
  const divVisualCompletion = divInstanceKey.querySelector(
    "div[data-visualcompletion]"
  );

  if (divVisualCompletion) {
    adjustVisualCompletionOverlay(divVisualCompletion, heightOfHtml5Controls);
  }

  hideIgVolumeControl(divInstanceKey);

  if (isInstagramReelsPage()) {
    // Instagram's minified class "xutac5l" identifies the gradient overlay.
    // This class name may change when Instagram updates — fallback to
    // structural selectors scoped to the instancekey container if the
    // primary class is absent. Any style-based fallback is additionally
    // filtered to elements that actually cover the video, so unrelated
    // gradient-styled elements (thumbnails, story rings, etc.) are
    // not restyled.
    const IG_GRADIENT_CLASS = "xutac5l";

    let gradientEls: Iterable<Element> = embedRootElem.querySelectorAll(
      `.${IG_GRADIENT_CLASS}`
    );

    if ([...gradientEls].length === 0) {
      // Restrict structural fallback to overlay-like containers inside
      // the instancekey wrapper, then require the element to visually
      // cover the video before treating it as the gradient overlay.
      const candidates = divInstanceKey.querySelectorAll(
        '[data-visualcompletion] [style*="gradient"], [role="presentation"] [style*="gradient"], [data-testid*="gradient"]'
      );

      gradientEls = [...candidates].filter((el) =>
        looksLikeCoversVideo(el, video)
      );
    }

    if ([...gradientEls].length === 0) {
      console.warn(
        "igvc: could not locate reel gradient overlay via class or structural selectors — selectors may need updating"
      );
    }

    for (const el of gradientEls) {
      if (el instanceof HTMLElement) {
        el.style.backgroundImage =
          "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.2) 98%, rgba(0,0,0,0) 100%)";
      }
    }
  }
};

const findInstanceKeyAmongAncestorSiblings = (
  video: HTMLVideoElement,
  maxLevels = 12
): Element | null => {
  for (const ancestor of nParents(video, maxLevels)) {
    if (ancestor.tagName === "SECTION") {
      break;
    }

    const parent = ancestor.parentElement;

    if (parent) {
      const found = [...parent.children].find(
        (el) =>
          el !== ancestor &&
          el instanceof HTMLElement &&
          Object.hasOwn(el.dataset, "instancekey") &&
          el.querySelector("[data-visualcompletion]") !== null
      );

      if (found) {
        return found;
      }
    }
  }

  return null;
};

const findInstanceKeyAmongDirectSiblings = (
  video: HTMLVideoElement
): Element | undefined => {
  const siblings = [...(video.parentElement?.children ?? [])];

  return siblings.find(
    (elem) =>
      elem instanceof HTMLElement &&
      Object.hasOwn(elem.dataset, "instancekey") &&
      elem.querySelector("[data-visualcompletion] div[role=presentation]") !==
        null
  );
};

const handleNoInstanceKeyOverlay = (
  embedRootElem: Element,
  video: HTMLVideoElement
): void => {
  const volumeOrTags = findVolumeOrTagsButtons(embedRootElem, video);

  for (const button of volumeOrTags.buttons) {
    button.parentElement?.classList.add("igvc-raise-button");
    button.parentElement?.classList.add("igvc-fade-button");
  }
};

/**
 * Adjust playback overlays while preserving Instagram's native controls.
 * @param embedRootElem - Root element containing the embedded video UI.
 * @param video - Video element whose overlay is being adjusted.
 */
export const modifyOverlayWithInstagramPlayControl = (
  embedRootElem: Element,
  video: HTMLVideoElement
): void => {
  const playHideElements = queryAll(
    ".videoSpritePlayButton",
    embedRootElem
  ).map((el) => el.parentElement);

  for (const el of playHideElements) {
    if (el) {
      hide(el);
    }
  }

  const heightOfHtml5Controls = HTML5_CONTROL_HEIGHT;
  const playButton = findPlayButton(embedRootElem, video);

  if (playButton) {
    const parent = playButton.parentElement;

    if (parent) {
      parent.style.bottom = heightOfHtml5Controls;
    }
  }

  const controlButton = findControlButton(embedRootElem, video);

  if (
    controlButton &&
    controlButton instanceof HTMLElement &&
    !controlButton.closest("[data-instancekey]") &&
    !controlButton.matches("[data-visualcompletion]")
  ) {
    controlButton.style.bottom = heightOfHtml5Controls;
  }

  const divInstanceKey =
    findInstanceKeyAmongAncestorSiblings(video) ??
    findInstanceKeyAmongDirectSiblings(video);

  if (divInstanceKey) {
    handleInstanceKeyOverlay(
      divInstanceKey,
      embedRootElem,
      video,
      heightOfHtml5Controls
    );
  } else {
    handleNoInstanceKeyOverlay(embedRootElem, video);
  }
};

import { dimensionWithinXPercentOrAbsoluteValue } from "@/lib/math";

import {
  isInstagramReelsPage,
  findVolumeOrTagsButtons,
  getVideoCoveringButtons,
  getComponentRootForStoryVideo,
  nParents,
} from "./button-finder";
import { queryAll, hide } from "./dom";

const HTML5_CONTROL_HEIGHT = "70px";
const TEXTAREA_ADJUST_PADDING = 16;

const looksLikeCoversVideoEl = (
  el: Element,
  vid: HTMLVideoElement
): boolean => {
  const videoRect = vid.getBoundingClientRect();
  const rect = el.getBoundingClientRect();

  const widthOk = dimensionWithinXPercentOrAbsoluteValue(
    videoRect.width,
    rect.width,
    1.1,
    100
  );
  const heightOk = dimensionWithinXPercentOrAbsoluteValue(
    videoRect.height,
    rect.height,
    1.2,
    100
  );

  return widthOk && heightOk;
};

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
      return looksLikeCoversVideoEl(parentEl, vid);
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

const getPercentageCssRuleVal = (
  elem: Element,
  cssProperty: string
): string => {
  if (!elem.parentElement) {
    return getComputedStyle(elem)[
      cssProperty as keyof CSSStyleDeclaration
    ] as string;
  }
  const parentStyle = (elem.parentElement as HTMLElement).style;
  const prevDisplay = parentStyle.display;
  parentStyle.display = "none";
  const cssRuleValue = getComputedStyle(elem)[
    cssProperty as keyof CSSStyleDeclaration
  ] as string;
  parentStyle.display = prevDisplay;
  return cssRuleValue;
};

const ensure100PercentHeight = (video: HTMLVideoElement): void => {
  for (const ancestor of nParents(video, 6)) {
    if (ancestor.tagName === "SECTION") {
      break;
    }

    const heightAsDeclared = getPercentageCssRuleVal(ancestor, "height");

    if (/\d+px/u.test(heightAsDeclared)) {
      break;
    }

    if (heightAsDeclared === "auto") {
      (ancestor as HTMLElement).style.setProperty("height", "100%");
    }
  }
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
  (divVisualCompletion as HTMLElement).style.setProperty(
    "bottom",
    heightOfHtml5Controls
  );
  (divVisualCompletion as HTMLElement).style.setProperty(
    "height",
    `calc(100% - ${heightOfHtml5Controls})`
  );
  if (!isInstagramReelsPage()) {
    (divPresentation as HTMLElement).style.setProperty(
      "bottom",
      heightOfHtml5Controls
    );
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
        looksLikeCoversVideoEl(el, video)
      );
    }
    if ([...gradientEls].length === 0) {
      console.warn(
        "igvc: could not locate reel gradient overlay via class or structural selectors — selectors may need updating"
      );
    }
    for (const el of gradientEls) {
      (el as HTMLElement).style.backgroundImage =
        "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.2) 98%, rgba(0,0,0,0) 100%)";
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
    if (!parent) {
      continue;
    }

    const found = [...parent.children].find(
      (el) =>
        el !== ancestor &&
        Object.hasOwn((el as HTMLElement).dataset, "instancekey") &&
        el.querySelector("[data-visualcompletion]")
    );
    if (found) {
      return found;
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
      Object.hasOwn((elem as HTMLElement).dataset, "instancekey") &&
      elem.querySelector("[data-visualcompletion] div[role=presentation]")
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
    !controlButton.closest("[data-instancekey]") &&
    !controlButton.matches("[data-visualcompletion]")
  ) {
    (controlButton as HTMLElement).style.bottom = heightOfHtml5Controls;
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

export const incapacitateStoryVideoPausingOverlays = (
  videoElement: HTMLVideoElement
): void => {
  const parent = videoElement.parentElement;
  if (!parent) {
    return;
  }
  const siblings = [...parent.children].filter((el) => el !== videoElement);
  for (const el of siblings) {
    hide(el);
  }
};

export const modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls =
  (video: HTMLVideoElement): void => {
    const componentRoot = getComponentRootForStoryVideo(video);
    if (!componentRoot) {
      return;
    }

    const textarea = componentRoot.querySelector("textarea[placeholder]");

    const findLikeButton = (): Element | null => {
      const likeButtonSvg = componentRoot.querySelector("[aria-label=Like]");
      if (likeButtonSvg) {
        return likeButtonSvg.closest("button");
      }

      return (
        queryAll("button > * svg", componentRoot)
          .filter((el) => !el.closest("header") && el.closest("button"))
          .map((el) => el.closest("button"))[0] ?? null
      );
    };

    const likeButton = findLikeButton();
    if (!textarea && !likeButton) {
      return;
    }

    const targetElement = (textarea ?? likeButton) as Element;
    const heightOfRow = targetElement.getBoundingClientRect().height;
    const videoRect = video.getBoundingClientRect();

    let sendMessageContainer: Element | undefined;
    for (const potentialContainer of nParents(targetElement, 8)) {
      const potentialContainerRect = potentialContainer.getBoundingClientRect();
      if (
        videoRect.width - potentialContainerRect.width <
        videoRect.width * 0.25
      ) {
        if (potentialContainerRect.height <= heightOfRow * 2) {
          sendMessageContainer = potentialContainer;
        } else {
          break;
        }
      }
    }

    if (!sendMessageContainer) {
      return;
    }

    const videoParent = video.parentElement;
    const videoParentParent = videoParent?.parentElement;
    if (videoParent && videoParentParent) {
      const videoParentHeight = videoParent.getBoundingClientRect().height;
      const videoParentParentHeight =
        videoParentParent.getBoundingClientRect().height;
      if (videoParentHeight > videoParentParentHeight) {
        (videoParent as HTMLElement).style.height =
          `${videoParentParentHeight}px`;
      }
    }

    const videoAndControlsContainer = componentRoot;
    const distanceFromTopOfSendMessageToBottomOfParentContainer =
      videoAndControlsContainer.getBoundingClientRect().bottom -
      sendMessageContainer.getBoundingClientRect().top;
    const videoHeightAdjustment =
      distanceFromTopOfSendMessageToBottomOfParentContainer +
      (textarea ? TEXTAREA_ADJUST_PADDING : 0);

    ensure100PercentHeight(video);
    video.style.height = `calc(100% - ${videoHeightAdjustment}px)`;
  };

import { getComponentRootForStoryVideo, nParents } from "./button-finder";
import { hide, queryAll } from "./dom";

const TEXTAREA_ADJUST_PADDING = 16;

const getPercentageCssRuleVal = (
  elem: Element,
  cssProperty: string
): string => {
  if (!elem.parentElement) {
    return getComputedStyle(elem).getPropertyValue(cssProperty);
  }

  const parentStyle = elem.parentElement.style;
  const prevDisplay = parentStyle.display;
  parentStyle.display = "none";

  const cssRuleValue = getComputedStyle(elem).getPropertyValue(cssProperty);

  parentStyle.display = prevDisplay;

  return cssRuleValue;
};

const ensure100PercentHeight = (video: HTMLVideoElement): void => {
  for (const ancestor of nParents(video, 6)) {
    if (ancestor.tagName === "SECTION") {
      break;
    }

    const heightAsDeclared = getPercentageCssRuleVal(ancestor, "height");

    if (heightAsDeclared.endsWith("px")) {
      return;
    }

    if (heightAsDeclared === "auto" && ancestor instanceof HTMLElement) {
      ancestor.style.setProperty("height", "100%");
    }
  }
};

/**
 * Hide sibling overlays that pause a story video when hovered.
 * @param videoElement - Story video whose sibling overlays should be hidden.
 */
export const incapacitateStoryVideoPausingOverlays = (
  videoElement: HTMLVideoElement
): void => {
  const parent = videoElement.parentElement;

  if (!parent) {
    return;
  }

  for (const sibling of parent.children) {
    if (sibling !== videoElement) {
      hide(sibling);
    }
  }
};

/**
 * Reduce story video height when a message box or like button overlaps it.
 * @param video - Story video whose visible area may need adjustment.
 */
export const modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls =
  (video: HTMLVideoElement): void => {
    const componentRoot = getComponentRootForStoryVideo(video);

    if (!componentRoot) {
      return;
    }

    const textarea = componentRoot.querySelector("textarea[placeholder]");

    const likeButtonSvg = componentRoot.querySelector("[aria-label=Like]");

    const likeButton =
      likeButtonSvg?.closest("button") ??
      queryAll("button > * svg", componentRoot)
        .filter((el) => !el.closest("header") && el.closest("button") !== null)
        .map((el) => el.closest("button"))[0] ??
      null;

    if (!textarea && !likeButton) {
      return;
    }

    const targetElement = textarea ?? likeButton;

    if (!targetElement) {
      return;
    }

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
        videoParent.style.height = `${videoParentParentHeight}px`;
      }
    }

    const distanceFromTopOfSendMessageToBottomOfParentContainer =
      componentRoot.getBoundingClientRect().bottom -
      sendMessageContainer.getBoundingClientRect().top;

    const videoHeightAdjustment =
      distanceFromTopOfSendMessageToBottomOfParentContainer +
      (textarea ? TEXTAREA_ADJUST_PADDING : 0);

    ensure100PercentHeight(video);
    video.style.height = `calc(100% - ${videoHeightAdjustment}px)`;
  };

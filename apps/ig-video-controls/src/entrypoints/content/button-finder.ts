import { dimensionWithinXPercentOrAbsoluteValue } from "@/lib/math";

const AUDIO_LABEL = "audio";
const ARIA_LABEL_ATTRIBUTE = "aria-label";
const TAGS_LABEL = "tags";

const hasChildrenMatchingAllSelectors = (
  elem: Element,
  cssSelectors: string[]
): boolean => {
  const childNodes = [...elem.childNodes];

  return cssSelectors.every((selector) =>
    childNodes.some((node) => node instanceof Element && node.matches(selector))
  );
};

/** @returns Whether the current Instagram route displays a story. */
export const isInstagramStoriesPage = (): boolean =>
  window.location.pathname.toLowerCase().startsWith("/stories/");

/** @returns Whether the current Instagram route displays a reel. */
export const isInstagramReelsPage = (): boolean =>
  window.location.pathname.toLowerCase().startsWith("/reels/");

/** @returns Whether the current Instagram route displays the home feed. */
export const isInstagramHomePage = (): boolean => {
  const path = window.location.pathname;

  return path === "/" || path === "/feed/";
};

/** @returns Whether the current Instagram route displays a post. */
export const isInstagramPostPage = (): boolean =>
  window.location.pathname.toLowerCase().startsWith("/p/");

/**
 * Get an ancestor at a specific distance from an element.
 * @param elem - Element from which to start walking.
 * @param n - Number of parent links to traverse.
 * @returns The ancestor at that distance, or null when it does not exist.
 */
export const nthParent = (elem: Element | null, n: number): Element | null => {
  let remaining = n;
  let current = elem;

  while (current && remaining > 0) {
    current = current.parentElement;
    remaining -= 1;
  }

  return current;
};

/**
 * Collect up to a given number of ancestors, nearest first.
 * @param elem - Element from which to start walking.
 * @param count - Maximum number of parent links to traverse.
 * @returns The ancestors found before reaching the root or count.
 */
export const nParents = (elem: Element | null, count: number): Element[] => {
  const parents: Element[] = [];
  let remaining = count;
  let current = elem;

  while (current && remaining > 0) {
    current = current.parentElement;

    if (current) {
      parents.push(current);
    }

    remaining -= 1;
  }

  return parents;
};

/**
 * Compare an element's rectangle with a video rectangle.
 * @param el - Candidate overlay element.
 * @param video - Video whose dimensions define the comparison.
 * @returns Whether the candidate is close enough in size to cover the video.
 */
export const looksLikeCoversVideo = (
  el: Element,
  video: HTMLVideoElement
): boolean => {
  const videoRect = video.getBoundingClientRect();
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

/**
 * Find role buttons and presentation elements covering a video.
 * @param searchRoot - Container to search for candidate controls.
 * @param video - Video element whose rectangle is used for comparison.
 * @returns Candidate elements whose dimensions cover the video.
 */
export const getVideoCoveringButtons = (
  searchRoot: Element,
  video: HTMLVideoElement
): Element[] =>
  [...searchRoot.querySelectorAll("[role=button],[role=presentation]")].filter(
    (el) => looksLikeCoversVideo(el, video)
  );

/**
 * Estimate the Instagram component root containing a video.
 * @param video - Video whose ancestor containers will be inspected.
 * @returns The closest ancestor containing a video-covering button.
 */
export const getEstimatedVideoComponentRootElement = (
  video: HTMLVideoElement
): Element | undefined => {
  for (const parent of nParents(video, 4)) {
    if (getVideoCoveringButtons(parent, video).length) {
      return parent;
    }
  }

  return undefined;
};

/**
 * Find the story container holding a video.
 * @param video - Story video whose ancestors will be inspected.
 * @returns The first ancestor with the expected story controls, if found.
 */
export const getComponentRootForStoryVideo = (
  video: HTMLVideoElement
): Element | undefined => {
  for (const ancestor of nParents(video, 8)) {
    if (
      hasChildrenMatchingAllSelectors(ancestor, ["button", "div", "header"])
    ) {
      return ancestor;
    }
  }

  return undefined;
};

/** Video controls discovered near an embedded Instagram video. */
export interface VolumeOrTagsButtons {
  audioButton: Element | undefined;
  buttons: Element[];
  tagsButton: Element | undefined;
}

const hasApproximateSizeOfSmallButton = (el: Element): boolean => {
  const elRect = el.getBoundingClientRect();

  return (
    elRect.width >= 10 &&
    elRect.width <= 60 &&
    elRect.height >= 10 &&
    elRect.height <= 60
  );
};

const matchesAriaLabel = (elem: Element, text: string): boolean => {
  const ariaLabel = elem.getAttribute(ARIA_LABEL_ATTRIBUTE);

  return (ariaLabel ?? "").toLowerCase().includes(text);
};

const svgStrokePathMatches = (
  button: Element,
  svgStrokePath: string
): boolean => {
  const path = button.querySelector("path");

  if (!path) {
    return false;
  }

  const d = path.getAttribute("d");

  return d !== null && d.toLowerCase().includes(svgStrokePath.toLowerCase());
};

const looksLikeAudioButton = (button: Element): boolean => {
  if (matchesAriaLabel(button, AUDIO_LABEL)) {
    return true;
  }

  return svgStrokePathMatches(button, "M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0");
};

const looksLikeTagsButton = (button: Element): boolean => {
  const svg = button.querySelector("svg");

  if (svg && matchesAriaLabel(svg, TAGS_LABEL)) {
    return true;
  }

  return svgStrokePathMatches(
    button,
    "M21.334 23H2.666a1 1 0 0 1-1-1v-1.354a6.279 6.279"
  );
};

const locatedInBottomThirdOfVideoRect = (
  el: Element,
  videoRect: DOMRect
): boolean => {
  const elRect = el.getBoundingClientRect();

  return (
    elRect.bottom <= videoRect.bottom &&
    elRect.top >= videoRect.bottom - videoRect.height / 3
  );
};

/**
 * Locate Instagram's audio and tags controls near a video.
 * @param embedRootElem - Root element for the embedded video component.
 * @param video - Video whose position constrains control candidates.
 * @returns The candidate controls and matches for the audio and tags buttons.
 */
export const findVolumeOrTagsButtons = (
  embedRootElem: Element,
  video: HTMLVideoElement
): VolumeOrTagsButtons => {
  const videoRect = video.getBoundingClientRect();

  let searchRoot = embedRootElem;

  if (isInstagramStoriesPage()) {
    const section = searchRoot.closest("section");

    if (section) {
      const header = section.querySelector("header");

      if (header) {
        searchRoot = header;
      }
    }
  }

  const buttons = [
    ...searchRoot.querySelectorAll("button:has(svg), [role='button']:has(svg)"),
  ].filter((btn) => {
    if (isInstagramStoriesPage()) {
      return hasApproximateSizeOfSmallButton(btn);
    }

    return (
      locatedInBottomThirdOfVideoRect(btn, videoRect) &&
      hasApproximateSizeOfSmallButton(btn)
    );
  });

  const audioButton = buttons.find(looksLikeAudioButton);
  const tagsButton = buttons.find(looksLikeTagsButton);

  return { audioButton, buttons, tagsButton };
};

const findInstanceKeyForVideo = (video: HTMLVideoElement): Element | null => {
  for (const ancestor of nParents(video, 12)) {
    if (ancestor.tagName === "SECTION") {
      return null;
    }

    const parent = ancestor.parentElement;

    const found = parent
      ? [...parent.children].find(
          (element) =>
            element !== ancestor &&
            element instanceof HTMLElement &&
            Object.hasOwn(element.dataset, "instancekey")
        )
      : undefined;

    if (found !== undefined) {
      return found;
    }
  }

  return null;
};

/**
 * Find Instagram's mute control for a video.
 * @param video - Video whose surrounding controls will be searched.
 * @returns The matching mute button, or null when no instance is found.
 */
export const findIgMuteButton = (video: HTMLVideoElement): Element | null => {
  const instanceKey = findInstanceKeyForVideo(video);

  if (!instanceKey) {
    return null;
  }

  for (const svg of instanceKey.querySelectorAll(
    `svg[${ARIA_LABEL_ATTRIBUTE}]`
  )) {
    const label = (svg.getAttribute(ARIA_LABEL_ATTRIBUTE) ?? "").toLowerCase();

    if (label.includes(AUDIO_LABEL)) {
      return svg.closest("[role='button']");
    }
  }

  return null;
};

/**
 * Read the mute state represented by Instagram's mute control.
 * @param muteBtn - Button whose icon indicates the current mute state.
 * @returns The mute state, or undefined when the icon is unrecognized.
 */
export const isIgMuted = (muteBtn: Element): boolean | undefined => {
  const svg = muteBtn.querySelector("svg");

  if (!svg) {
    return undefined;
  }

  const ariaLabel = (
    svg.getAttribute(ARIA_LABEL_ATTRIBUTE) ?? ""
  ).toLowerCase();

  if (ariaLabel.includes(AUDIO_LABEL)) {
    return ariaLabel.includes("muted");
  }

  const viewBox = svg.getAttribute("viewBox");

  if (viewBox !== null && viewBox.length > 0) {
    return viewBox === "0 0 48 48";
  }

  return undefined;
};

import { dimensionWithinXPercentOrAbsoluteValue } from "@/lib/math";

const hasChildrenMatchingAllSelectors = (
  elem: Element,
  cssSelectors: string[]
): boolean => {
  const childNodes = [...elem.childNodes] as Element[];
  return cssSelectors.every((selector) =>
    childNodes.some((node) => "matches" in node && node.matches(selector))
  );
};

export const isInstagramStoriesPage = (): boolean =>
  window.location.pathname.toLowerCase().startsWith("/stories/");

export const isInstagramReelsPage = (): boolean =>
  window.location.pathname.toLowerCase().startsWith("/reels/");

export const isInstagramHomePage = (): boolean => {
  const path = window.location.pathname;
  return path === "/" || path === "/feed/";
};

export const isInstagramPostPage = (): boolean =>
  window.location.pathname.toLowerCase().startsWith("/p/");

export const nthParent = (elem: Element | null, n: number): Element | null => {
  let remaining = n;
  let current = elem;
  while (current && remaining > 0) {
    current = current.parentElement;
    remaining -= 1;
  }
  return current;
};

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

export const getVideoCoveringButtons = (
  searchRoot: Element,
  video: HTMLVideoElement
): Element[] =>
  [...searchRoot.querySelectorAll("[role=button],[role=presentation]")].filter(
    (el) => looksLikeCoversVideo(el, video)
  );

export const getEstimatedVideoComponentRootElement = (
  video: HTMLVideoElement
): Element | undefined => {
  for (const parent of nParents(video, 4)) {
    if (getVideoCoveringButtons(parent, video).length) {
      return parent;
    }
  }
};

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
};

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
  const ariaLabel = elem.getAttribute("aria-label");
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
  return !!d && d.toLowerCase().includes(svgStrokePath.toLowerCase());
};

const looksLikeAudioButton = (button: Element): boolean => {
  if (matchesAriaLabel(button, "audio")) {
    return true;
  }
  return svgStrokePathMatches(button, "M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0");
};

const looksLikeTagsButton = (button: Element): boolean => {
  const svg = button.querySelector("svg");
  if (svg && matchesAriaLabel(svg, "tags")) {
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
      break;
    }
    const parent = ancestor.parentElement;
    if (!parent) {
      continue;
    }

    const found = [...parent.children].find(
      (el) =>
        el !== ancestor &&
        Object.hasOwn((el as HTMLElement).dataset, "instancekey")
    );
    if (found) {
      return found;
    }
  }
  return null;
};

export const findIgMuteButton = (video: HTMLVideoElement): Element | null => {
  const instanceKey = findInstanceKeyForVideo(video);
  if (!instanceKey) {
    return null;
  }

  for (const svg of instanceKey.querySelectorAll("svg[aria-label]")) {
    const label = (svg.getAttribute("aria-label") ?? "").toLowerCase();
    if (label.includes("audio")) {
      return svg.closest("[role='button']");
    }
  }
  return null;
};

export const isIgMuted = (muteBtn: Element): boolean | undefined => {
  const svg = muteBtn.querySelector("svg");
  if (!svg) {
    return undefined;
  }

  const ariaLabel = (svg.getAttribute("aria-label") ?? "").toLowerCase();
  if (ariaLabel.includes("audio")) {
    return ariaLabel.includes("muted");
  }

  const viewBox = svg.getAttribute("viewBox");
  if (viewBox) {
    return viewBox === "0 0 48 48";
  }

  return undefined;
};

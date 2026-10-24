import { getTweetDetails, viewQuotedTweets } from "@/lib/tweet";

const SVG_NS = "http://www.w3.org/2000/svg";
const ARTICLE_SELECTOR = "article";
const GROUP_SELECTOR = '[role="group"]';

const QUOTE_ICON_PATHS = [
  "M10 12H5C4.44772 12 4 11.5523 4 11V7.5C4 6.94772 4.44772 6.5 5 6.5H9C9.55228 6.5 10 6.94772 10 7.5V12ZM10 12C10 14.5 9 16 6 17.5",
  "M20 12H15C14.4477 12 14 11.5523 14 11V7.5C14 6.94772 14.4477 6.5 15 6.5H19C19.5523 6.5 20 6.94772 20 7.5V12ZM20 12C20 14.5 19 16 16 17.5",
];

type MutationObserverCtor = new (
  callback: MutationCallback
) => Pick<MutationObserver, "observe">;

const NATIVE_QUOTES_LINK_SELECTOR = 'a[href$="/quotes"]';
const HIDDEN_NATIVE_QUOTES_ATTR = "data-quote-viewer-hidden-native-quotes";

const hideNativeQuotesLink = (anchor: Element): void => {
  // X nests menu-item links inside layout wrappers. Hiding the immediate
  // parent can hide the entire menu (and prevent the More menu from opening).
  const target =
    anchor.closest('[role="menuitem"]') ?? anchor.parentElement ?? anchor;

  target.setAttribute(HIDDEN_NATIVE_QUOTES_ATTR, "true");
  target.setAttribute("aria-hidden", "true");

  if (target instanceof HTMLElement) {
    target.style.setProperty("display", "none", "important");
  }
};

const hideNativeQuotesLinks = (root: ParentNode): void => {
  if (root instanceof Element && root.matches(NATIVE_QUOTES_LINK_SELECTOR)) {
    hideNativeQuotesLink(root);
  }

  for (const anchor of root.querySelectorAll(NATIVE_QUOTES_LINK_SELECTOR)) {
    hideNativeQuotesLink(anchor);
  }
};

const processAddedNode = (
  node: Node,
  pending: WeakSet<Element>,
  trySetIcon: (article: Element) => void
): void => {
  if (!(node instanceof Element)) {
    return;
  }

  hideNativeQuotesLinks(node);

  const articles =
    node.tagName === "ARTICLE"
      ? [node]
      : [...node.querySelectorAll(ARTICLE_SELECTOR)];

  for (const article of articles) {
    trySetIcon(article);
  }

  const groups =
    node.getAttribute("role") === "group"
      ? [node]
      : [...node.querySelectorAll(GROUP_SELECTOR)];

  for (const group of groups) {
    const article = group.closest(ARTICLE_SELECTOR);

    if (article !== null && pending.has(article)) {
      trySetIcon(article);
    }
  }
};

const processMutations = (
  mutations: MutationRecord[],
  pending: WeakSet<Element>,
  trySetIcon: (article: Element) => void
): void => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      processAddedNode(node, pending, trySetIcon);
    }
  }
};

/**
 * Create an SVG quote icon.
 * @param doc - Document used to create the SVG nodes.
 * @returns A quote icon SVG element.
 */
export const createQuoteIconSvg = (doc: Document = document): SVGSVGElement => {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "1.6em");
  svg.setAttribute("height", "1.6em");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("color", "currentColor");

  for (const d of QUOTE_ICON_PATHS) {
    const path = doc.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linecap", "round");
    svg.append(path);
  }

  return svg;
};

/**
 * Create the quote viewer and its DOM mutation observer.
 * @param doc - Document containing the posts.
 * @param Observer - Mutation observer constructor.
 * @returns Controls for initializing the viewer and processing post updates.
 */
export const createQuoteViewer = (
  doc: Document = document,
  Observer: MutationObserverCtor = MutationObserver
) => {
  const pending = new WeakSet<Element>();

  const attachQuoteIcon = (article: Element): void => {
    const actionBar = article.querySelector(GROUP_SELECTOR);

    const container = doc.createElement("div");
    container.classList.add("quoted-tweets-container");

    const icon = doc.createElement("button");
    icon.type = "button";
    icon.append(createQuoteIconSvg(doc));
    icon.setAttribute("aria-label", "View quoted tweets");
    icon.addEventListener("click", (event) => {
      event.stopImmediatePropagation();
      const { tweetId, twitterHandle } = getTweetDetails(article);

      if (tweetId !== null) {
        viewQuotedTweets(twitterHandle, tweetId);
      }
    });

    container.append(icon);
    actionBar?.append(container);
  };

  const trySetIcon = (article: Element): void => {
    if (article.querySelector(".quoted-tweets-container")) {
      pending.delete(article);

      return;
    }

    if (!article.querySelector(GROUP_SELECTOR)) {
      pending.add(article);

      return;
    }

    pending.delete(article);
    attachQuoteIcon(article);
  };

  const handleMutations = (mutations: MutationRecord[]): void => {
    processMutations(mutations, pending, trySetIcon);
  };

  const main = (): Pick<MutationObserver, "observe"> => {
    hideNativeQuotesLinks(doc);

    for (const article of doc.querySelectorAll(ARTICLE_SELECTOR)) {
      trySetIcon(article);
    }

    const observer = new Observer(handleMutations);
    observer.observe(doc.body, { childList: true, subtree: true });

    return observer;
  };

  return {
    hideNativeQuotesLinks,
    main,
    processMutations: handleMutations,
    trySetIcon,
  };
};

/**
 * Initialize the quote viewer using the global document and observer.
 * @returns The active mutation observer.
 */
export const setupQuoteViewer = (): Pick<MutationObserver, "observe"> =>
  createQuoteViewer().main();

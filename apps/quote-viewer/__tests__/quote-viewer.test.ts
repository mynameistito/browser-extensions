import { Window } from "happy-dom";
import { it, afterEach, describe, expect, beforeEach } from "vitest";

import {
  createQuoteIconSvg,
  createQuoteViewer,
  setupQuoteViewer,
} from "../src/entrypoints/content/dom";
import { getTweetDetails, viewQuotedTweets } from "../src/lib/tweet";

const originalElement = globalThis.Element;
const originalEvent = globalThis.Event;
const originalHTMLElement = globalThis.HTMLElement;
const originalMutationObserver = globalThis.MutationObserver;
const originalNode = globalThis.Node;
const originalPopStateEvent = globalThis.PopStateEvent;
const originalWindow = globalThis.window;

let testWindow: Window;

const installWindow = (): void => {
  testWindow = new Window({ url: "https://x.com" });
  Object.defineProperties(globalThis, {
    Element: { configurable: true, value: testWindow.Element },
    Event: { configurable: true, value: testWindow.Event },
    HTMLElement: { configurable: true, value: testWindow.HTMLElement },
    MutationObserver: {
      configurable: true,
      value: testWindow.MutationObserver,
    },
    Node: { configurable: true, value: testWindow.Node },
    PopStateEvent: { configurable: true, value: testWindow.PopStateEvent },
    document: { configurable: true, value: testWindow.document },
    window: { configurable: true, value: testWindow },
  });
};

const restoreWindow = (): void => {
  testWindow.close();
  Object.defineProperties(globalThis, {
    Element: { configurable: true, value: originalElement },
    Event: { configurable: true, value: originalEvent },
    HTMLElement: { configurable: true, value: originalHTMLElement },
    MutationObserver: { configurable: true, value: originalMutationObserver },
    Node: { configurable: true, value: originalNode },
    PopStateEvent: { configurable: true, value: originalPopStateEvent },
    window: { configurable: true, value: originalWindow },
  });
  Reflect.deleteProperty(globalThis, "document");
};

const createArticle = (
  options: { href?: string; includeGroup?: boolean; text?: string } = {}
): HTMLElement => {
  const {
    href,
    includeGroup = true,
    text = "Display Name @jack · 1h",
  } = options;

  const article = document.createElement("article");

  const userName = document.createElement("div");
  const displayName = document.createElement("div");
  const handle = document.createElement("div");
  userName.dataset.testid = "User-Name";
  handle.textContent = text;
  userName.append(displayName, handle);
  article.append(userName);

  if (href !== undefined) {
    const anchor = document.createElement("a");
    anchor.href = href;
    article.append(anchor);
  }

  if (includeGroup) {
    const group = document.createElement("div");
    group.setAttribute("role", "group");
    article.append(group);
  }

  document.body.append(article);

  return article;
};

const appendNativeQuotesLink = (
  parent: HTMLElement,
  text = "View quotes",
  href = "/jack/status/12345/quotes"
): HTMLElement => {
  const container = document.createElement("div");
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.textContent = text;
  container.append(anchor);
  parent.append(container);

  return container;
};

const captureAddedNodes = (
  parent: Element,
  addNodes: () => void
): MutationRecord[] => {
  const observer = new MutationObserver(() => {});
  observer.observe(parent, { childList: true, subtree: true });
  addNodes();

  return observer.takeRecords();
};

describe(getTweetDetails, () => {
  beforeEach(installWindow);
  afterEach(restoreWindow);

  it("extracts the handle and tweet ID from relative tweet links", () => {
    const article = createArticle({ href: "/jack/status/12345" });

    expect(getTweetDetails(article)).toStrictEqual({
      tweetId: "12345",
      twitterHandle: "jack",
    });
  });

  it("extracts handles followed by whitespace", () => {
    const article = createArticle({
      href: "https://twitter.com/jack/status/999",
      text: "Display Name @jack 1h",
    });

    expect(getTweetDetails(article)).toStrictEqual({
      tweetId: "999",
      twitterHandle: "jack",
    });
  });

  it("defaults to x when no handle can be parsed", () => {
    const article = createArticle({
      href: "/someone/status/42",
      text: "Display Name",
    });

    expect(getTweetDetails(article)).toStrictEqual({
      tweetId: "42",
      twitterHandle: "x",
    });
  });

  it("returns a null tweet ID when there is no matching status link", () => {
    const article = createArticle({ href: "/jack/with_replies" });

    expect(getTweetDetails(article)).toStrictEqual({
      tweetId: null,
      twitterHandle: "jack",
    });
  });

  it("ignores invalid URLs", () => {
    const article = createArticle({ href: "https://[invalid" });

    expect(getTweetDetails(article)).toStrictEqual({
      tweetId: null,
      twitterHandle: "jack",
    });
  });
});

describe(viewQuotedTweets, () => {
  beforeEach(installWindow);
  afterEach(restoreWindow);

  it("updates browser state, dispatches popstate, and scrolls to top", () => {
    let popStateCount = 0;
    const scrollPositions: (readonly [number, number])[] = [];
    window.addEventListener("popstate", () => {
      popStateCount += 1;
    });
    Object.defineProperty(window, "scrollTo", {
      value: (x: number, y: number) => {
        scrollPositions.push([x, y]);
      },
    });

    viewQuotedTweets("jack", "12345");

    expect(window.location.pathname).toBe("/jack/status/12345/quotes");
    expect(popStateCount).toBe(1);
    expect(scrollPositions).toStrictEqual([[0, 0]]);
  });
});

describe("content DOM behavior", () => {
  beforeEach(installWindow);
  afterEach(restoreWindow);

  it("creates the quote icon SVG", () => {
    const svg = createQuoteIconSvg(document);

    expect(svg.tagName).toBe("svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.querySelectorAll("path")).toHaveLength(2);
  });

  it("attaches one quote button to an article action bar", () => {
    const article = createArticle({ href: "/jack/status/12345" });

    const viewer = createQuoteViewer(document);

    viewer.trySetIcon(article);
    viewer.trySetIcon(article);

    expect(article.querySelectorAll(".quoted-tweets-container")).toHaveLength(
      1
    );
    expect(article.querySelector("button")?.getAttribute("aria-label")).toBe(
      "View quoted tweets"
    );
  });

  it("hides native quotes links during setup", () => {
    const article = createArticle({ href: "/jack/status/12345" });

    const nativeQuotes = appendNativeQuotesLink(article);
    const viewer = createQuoteViewer(document);

    viewer.main();

    expect(nativeQuotes.dataset.quoteViewerHiddenNativeQuotes).toBe("true");
    expect(nativeQuotes.getAttribute("aria-hidden")).toBe("true");
  });

  it("hides only the native quotes menu item, not its menu", () => {
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    const wrapper = document.createElement("div");
    const menuItem = document.createElement("a");
    menuItem.setAttribute("role", "menuitem");
    menuItem.href = "/jack/status/12345/quotes";
    wrapper.append(menuItem);
    menu.append(wrapper);
    document.body.append(menu);

    createQuoteViewer(document).hideNativeQuotesLinks(document);

    expect(menu.dataset.quoteViewerHiddenNativeQuotes).toBeUndefined();
    expect(menu.getAttribute("aria-hidden")).toBeNull();
    expect(menuItem.dataset.quoteViewerHiddenNativeQuotes).toBe("true");
    expect(menuItem.getAttribute("aria-hidden")).toBe("true");
  });

  it("does not hide non-quotes links", () => {
    const article = createArticle({ href: "/jack/status/12345" });

    const nativeQuotes = appendNativeQuotesLink(
      article,
      "View reposts",
      "/jack/status/12345/retweets"
    );

    const viewer = createQuoteViewer(document);

    viewer.main();

    expect(nativeQuotes.dataset.quoteViewerHiddenNativeQuotes).toBeUndefined();
    expect(nativeQuotes.getAttribute("aria-hidden")).toBeNull();
  });

  it("clicking the quote button navigates to quotes", () => {
    const article = createArticle({ href: "/jack/status/12345" });
    const viewer = createQuoteViewer(document);
    viewer.trySetIcon(article);

    article.querySelector("button")?.dispatchEvent(new Event("click"));

    expect(window.location.pathname).toBe("/jack/status/12345/quotes");
  });

  it("does not navigate when a tweet ID is missing", () => {
    const article = createArticle();
    const viewer = createQuoteViewer(document);
    viewer.trySetIcon(article);

    article.querySelector("button")?.dispatchEvent(new Event("click"));

    expect(window.location.pathname).toBe("/");
  });

  it("observes existing articles during setup", () => {
    const article = createArticle({ href: "/jack/status/12345" });
    const observer = createQuoteViewer(document).main();

    expect(article.querySelectorAll(".quoted-tweets-container")).toHaveLength(
      1
    );
    expect(observer).toBeInstanceOf(MutationObserver);
  });

  it("setupQuoteViewer uses the global document and observer", () => {
    const article = createArticle({ href: "/jack/status/12345" });

    const observer = setupQuoteViewer();

    expect(article.querySelectorAll(".quoted-tweets-container")).toHaveLength(
      1
    );
    expect(observer).toBeInstanceOf(MutationObserver);
  });

  it("processes newly inserted articles and nested articles", () => {
    const viewer = createQuoteViewer(document);
    const direct = document.createElement("article");
    const wrapper = document.createElement("div");
    const nested = document.createElement("article");
    direct.append(
      Object.assign(document.createElement("a"), {
        href: "/jack/status/1",
      }),
      Object.assign(document.createElement("div"), {
        role: "group",
      })
    );
    nested.append(
      Object.assign(document.createElement("a"), {
        href: "/jack/status/2",
      }),
      Object.assign(document.createElement("div"), {
        role: "group",
      })
    );
    wrapper.append(nested);
    viewer.processMutations(
      captureAddedNodes(document.body, () => {
        document.body.append(direct, wrapper);
      })
    );

    expect(direct.querySelectorAll(".quoted-tweets-container")).toHaveLength(1);
    expect(nested.querySelectorAll(".quoted-tweets-container")).toHaveLength(1);
  });

  it("attaches an icon when a pending article later receives a group", () => {
    const article = createArticle({
      href: "/jack/status/12345",
      includeGroup: false,
    });

    const viewer = createQuoteViewer(document);

    viewer.trySetIcon(article);

    const group = document.createElement("div");
    group.setAttribute("role", "group");
    viewer.processMutations(
      captureAddedNodes(article, () => {
        article.append(group);
      })
    );

    expect(article.querySelectorAll(".quoted-tweets-container")).toHaveLength(
      1
    );
  });
});

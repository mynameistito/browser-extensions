import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  createQuoteIconSvg,
  createQuoteViewer,
  setupQuoteViewer,
} from "../src/entrypoints/content/dom";
import { getTweetDetails, viewQuotedTweets } from "../src/lib/tweet";

type Attributes = Record<string, string>;

interface TestDocument extends TestElement {
  readonly body: TestElement;
  createElement: (tagName: string) => TestElement;
  createElementNS: (namespace: string, tagName: string) => TestElement;
}

interface TestMutationObserverInstance {
  observedOptions: MutationObserverInit | null;
  observedTarget: Element | null;
  observe: (target: Element, options?: MutationObserverInit) => void;
}

interface TestMutationObserverConstructor {
  new (handler: MutationCallback): TestMutationObserverInstance;
  callback: MutationCallback | null;
  prototype: TestMutationObserverInstance;
}

class TestElement extends EventTarget {
  readonly attributes: Attributes = {};
  readonly children: TestElement[] = [];
  readonly classList: Pick<DOMTokenList, "add" | "contains">;
  readonly dataset: Record<string, string> = {};
  readonly tagName: string;
  parentElement: TestElement | null = null;
  textContent = "";
  type = "";

  constructor(tagName: string) {
    super();
    this.tagName = tagName;
    const classes = new Set<string>();
    this.classList = {
      add: (className: string) => {
        classes.add(className);
      },
      contains: (className: string) => classes.has(className),
    };
  }

  append(...children: TestElement[]): void {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  closest(selector: string): TestElement | null {
    return this.matches(selector)
      ? this
      : (this.parentElement?.closest(selector) ?? null);
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  matches(selector: string): boolean {
    if (selector === ".quoted-tweets-container") {
      return this.classList.contains("quoted-tweets-container");
    }

    if (selector === '[role="group"]') {
      return this.getAttribute("role") === "group";
    }

    if (selector.startsWith('a[href*="') && selector.endsWith('"]')) {
      const needle = selector.slice('a[href*="'.length, -2);
      return (
        this.tagName === "A" &&
        this.getAttribute("href")?.includes(needle) === true
      );
    }

    if (selector.startsWith('a[href$="') && selector.endsWith('"]')) {
      const needle = selector.slice('a[href$="'.length, -2);
      return (
        this.tagName === "A" &&
        this.getAttribute("href")?.endsWith(needle) === true
      );
    }

    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  querySelector<T extends Element = Element>(selector: string): T | null {
    return (this.querySelectorAll(selector)[0] as T | undefined) ?? null;
  }

  querySelectorAll<T extends Element = Element>(selector: string): T[] {
    if (selector === '[data-testid*="User-Name"] > div:nth-child(2)') {
      const userName = this.descendants().find(
        (element) => element.dataset.testid?.includes("User-Name") === true
      );
      return (userName?.children[1]
        ? [userName.children[1]]
        : []) as unknown as T[];
    }

    return this.descendants().filter((element) =>
      element.matches(selector)
    ) as unknown as T[];
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;

    if (name.startsWith("data-")) {
      const parts = name.slice("data-".length).split("-");
      const datasetKey = parts
        .map((part, index) =>
          index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`
        )
        .join("");
      this.dataset[datasetKey] = value;
    }
  }

  private descendants(): TestElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
}

const createTestDocument = (): TestDocument => {
  const doc = new TestElement("#DOCUMENT") as TestDocument;
  doc.createElement = (tagName: string) =>
    new TestElement(tagName.toUpperCase());
  doc.createElementNS = (_namespace: string, tagName: string) =>
    doc.createElement(tagName);
  Object.defineProperty(doc, "body", { value: doc.createElement("body") });
  doc.append(doc.body);
  return doc;
};

const TestPopStateEvent = function testPopStateEvent(
  type: string,
  options: { state: unknown }
) {
  const event = new Event(type);
  Object.defineProperty(event, "options", { value: options });
  return event;
} as unknown as typeof PopStateEvent;

const TestMutationObserver = function testMutationObserver(
  this: TestMutationObserverInstance,
  handler: MutationCallback
) {
  TestMutationObserver.callback = handler;
  this.observedTarget = null;
  this.observedOptions = null;
} as unknown as TestMutationObserverConstructor;

TestMutationObserver.callback = null;
TestMutationObserver.prototype.observe = function observe(
  this: TestMutationObserverInstance,
  target: Element,
  options?: MutationObserverInit
): void {
  this.observedTarget = target;
  this.observedOptions = options ?? null;
};

const originalElement = globalThis.Element;
const originalMutationObserver = globalThis.MutationObserver;
const originalPopStateEvent = globalThis.PopStateEvent;
const originalWindow = globalThis.window;

const installGlobals = (doc: TestDocument) => {
  const calls = {
    dispatchEvents: [] as Event[],
    replaceState: [] as [unknown, string, string][],
    scrollTo: [] as [number, number][],
  };

  const testWindow = {
    dispatchEvent: (event: Event) => {
      calls.dispatchEvents.push(event);
      return true;
    },
    history: {
      replaceState: (state: unknown, title: string, url: string) => {
        calls.replaceState.push([state, title, url]);
      },
    },
    location: { origin: "https://x.com" },
    scrollTo: (x: number, y: number) => {
      calls.scrollTo.push([x, y]);
    },
  };

  Object.defineProperties(globalThis, {
    Element: { configurable: true, value: TestElement },
    MutationObserver: { configurable: true, value: TestMutationObserver },
    PopStateEvent: { configurable: true, value: TestPopStateEvent },
    document: { configurable: true, value: doc },
    window: { configurable: true, value: testWindow },
  });

  return calls;
};

const restoreGlobals = () => {
  Object.defineProperties(globalThis, {
    Element: { configurable: true, value: originalElement },
    MutationObserver: { configurable: true, value: originalMutationObserver },
    PopStateEvent: { configurable: true, value: originalPopStateEvent },
    window: { configurable: true, value: originalWindow },
  });
  Reflect.deleteProperty(globalThis, "document");
};

const asDocument = (doc: TestDocument): Document => doc as unknown as Document;

const asElement = (element: TestElement): Element =>
  element as unknown as Element;

const asObserver = (): typeof MutationObserver =>
  TestMutationObserver as unknown as typeof MutationObserver;

const createArticle = ({
  href,
  includeGroup = true,
  text = "Display Name @jack · 1h",
}: {
  href?: string;
  includeGroup?: boolean;
  text?: string;
} = {}) => {
  const doc = createTestDocument();
  const article = doc.createElement("article");
  const userName = doc.createElement("div");
  const displayName = doc.createElement("div");
  const handle = doc.createElement("div");
  userName.dataset.testid = "User-Name";
  handle.textContent = text;
  userName.append(displayName, handle);
  article.append(userName);

  if (href) {
    const anchor = doc.createElement("a");
    anchor.setAttribute("href", href);
    article.append(anchor);
  }

  if (includeGroup) {
    const group = doc.createElement("div");
    group.setAttribute("role", "group");
    article.append(group);
  }

  doc.body.append(article);
  return { article, doc };
};

const mutationWith = (nodes: unknown[]): MutationRecord =>
  ({ addedNodes: nodes }) as unknown as MutationRecord;

const appendNativeQuotesLink = (
  doc: TestDocument,
  parent: TestElement,
  text = "View quotes",
  href = "/jack/status/12345/quotes"
): TestElement => {
  const container = doc.createElement("div");
  const anchor = doc.createElement("a");
  anchor.setAttribute("href", href);
  anchor.textContent = text;
  container.append(anchor);
  parent.append(container);
  return container;
};

beforeEach(() => {
  TestMutationObserver.callback = null;
});

afterEach(() => {
  restoreGlobals();
});

describe("getTweetDetails", () => {
  test("extracts the handle and tweet ID from relative tweet links", () => {
    const { article, doc } = createArticle({ href: "/jack/status/12345" });
    installGlobals(doc);

    expect(getTweetDetails(asElement(article))).toEqual({
      tweetId: "12345",
      twitterHandle: "jack",
    });
  });

  test("extracts handles followed by whitespace", () => {
    const { article, doc } = createArticle({
      href: "https://twitter.com/jack/status/999",
      text: "Display Name @jack 1h",
    });
    installGlobals(doc);

    expect(getTweetDetails(asElement(article))).toEqual({
      tweetId: "999",
      twitterHandle: "jack",
    });
  });

  test("defaults to x when no handle can be parsed", () => {
    const { article, doc } = createArticle({
      href: "/someone/status/42",
      text: "Display Name",
    });
    installGlobals(doc);

    expect(getTweetDetails(asElement(article))).toEqual({
      tweetId: "42",
      twitterHandle: "x",
    });
  });

  test("returns a null tweet ID when there is no matching status link", () => {
    const { article, doc } = createArticle({ href: "/jack/with_replies" });
    installGlobals(doc);

    expect(getTweetDetails(asElement(article))).toEqual({
      tweetId: null,
      twitterHandle: "jack",
    });
  });

  test("returns a null tweet ID when a status link has no ID", () => {
    const { article, doc } = createArticle({ href: "/jack/status" });
    installGlobals(doc);

    expect(getTweetDetails(asElement(article))).toEqual({
      tweetId: null,
      twitterHandle: "jack",
    });
  });

  test("ignores invalid URLs", () => {
    const { article, doc } = createArticle({ href: "http://[invalid" });
    installGlobals(doc);

    expect(getTweetDetails(asElement(article))).toEqual({
      tweetId: null,
      twitterHandle: "jack",
    });
  });
});

describe("viewQuotedTweets", () => {
  test("updates browser state, dispatches popstate, and scrolls to top", () => {
    const doc = createTestDocument();
    const calls = installGlobals(doc);

    viewQuotedTweets("jack", "12345");

    expect(calls.replaceState).toEqual([[{}, "", "/jack/status/12345/quotes"]]);
    expect(calls.dispatchEvents).toHaveLength(1);
    expect(calls.dispatchEvents[0]?.type).toBe("popstate");
    expect(calls.scrollTo).toEqual([[0, 0]]);
  });
});

describe("content DOM behavior", () => {
  test("creates the quote icon SVG", () => {
    const doc = createTestDocument();

    const svg = createQuoteIconSvg(asDocument(doc)) as unknown as TestElement;

    expect(svg.tagName).toBe("SVG");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.querySelectorAll("path")).toHaveLength(2);
  });

  test("attaches one quote button to an article action bar", () => {
    const { article, doc } = createArticle({ href: "/jack/status/12345" });
    installGlobals(doc);
    const viewer = createQuoteViewer(asDocument(doc), asObserver());

    viewer.trySetIcon(asElement(article));
    viewer.trySetIcon(asElement(article));

    expect(article.querySelectorAll(".quoted-tweets-container")).toHaveLength(
      1
    );
    expect(article.querySelector("button")?.getAttribute("aria-label")).toBe(
      "View quoted tweets"
    );
  });

  test("hides X's native View quotes link during setup", () => {
    const { article, doc } = createArticle({ href: "/jack/status/12345" });
    const nativeQuotes = appendNativeQuotesLink(doc, article);
    installGlobals(doc);
    const viewer = createQuoteViewer(asDocument(doc), asObserver());

    viewer.main();

    expect(nativeQuotes.dataset.quoteViewerHiddenNativeQuotes).toBe("true");
    expect(nativeQuotes.getAttribute("aria-hidden")).toBe("true");
  });

  test("hides X's native View quotes link when it is inserted later", () => {
    const { article, doc } = createArticle({ href: "/jack/status/12345" });
    installGlobals(doc);
    const viewer = createQuoteViewer(asDocument(doc), asObserver());
    const nativeQuotes = appendNativeQuotesLink(doc, article);

    viewer.processMutations([mutationWith([nativeQuotes])]);

    expect(nativeQuotes.dataset.quoteViewerHiddenNativeQuotes).toBe("true");
    expect(nativeQuotes.getAttribute("aria-hidden")).toBe("true");
  });

  test("hides localized native quotes links", () => {
    const { article, doc } = createArticle({ href: "/jack/status/12345" });
    const nativeQuotes = appendNativeQuotesLink(
      doc,
      article,
      "Voir les citations"
    );
    installGlobals(doc);
    const viewer = createQuoteViewer(asDocument(doc), asObserver());

    viewer.main();

    expect(nativeQuotes.dataset.quoteViewerHiddenNativeQuotes).toBe("true");
    expect(nativeQuotes.getAttribute("aria-hidden")).toBe("true");
  });

  test("does not hide non-quotes links", () => {
    const { article, doc } = createArticle({ href: "/jack/status/12345" });
    const nativeQuotes = appendNativeQuotesLink(
      doc,
      article,
      "View reposts",
      "/jack/status/12345/retweets"
    );
    installGlobals(doc);
    const viewer = createQuoteViewer(asDocument(doc), asObserver());

    viewer.main();

    expect(nativeQuotes.dataset.quoteViewerHiddenNativeQuotes).toBeUndefined();
    expect(nativeQuotes.getAttribute("aria-hidden")).toBeNull();
  });

  test("clicking the quote button navigates when a tweet ID exists", () => {
    const { article, doc } = createArticle({ href: "/jack/status/12345" });
    const calls = installGlobals(doc);
    const viewer = createQuoteViewer(asDocument(doc), asObserver());
    viewer.trySetIcon(asElement(article));

    article.querySelector("button")?.dispatchEvent(new Event("click"));

    expect(calls.replaceState).toEqual([[{}, "", "/jack/status/12345/quotes"]]);
  });

  test("clicking the quote button does not navigate without a tweet ID", () => {
    const { article, doc } = createArticle();
    const calls = installGlobals(doc);
    const viewer = createQuoteViewer(asDocument(doc), asObserver());
    viewer.trySetIcon(asElement(article));

    article.querySelector("button")?.dispatchEvent(new Event("click"));

    expect(calls.replaceState).toEqual([]);
  });

  test("observes existing articles during setup", () => {
    const { article, doc } = createArticle({ href: "/jack/status/12345" });
    installGlobals(doc);
    const viewer = createQuoteViewer(asDocument(doc), asObserver());

    const observer = viewer.main() as TestMutationObserverInstance;

    expect(article.querySelectorAll(".quoted-tweets-container")).toHaveLength(
      1
    );
    expect(observer.observedTarget).toBe(asElement(doc.body));
    expect(observer.observedOptions).toEqual({
      childList: true,
      subtree: true,
    });
  });

  test("setupQuoteViewer uses the global document and observer", () => {
    const { article, doc } = createArticle({ href: "/jack/status/12345" });
    installGlobals(doc);

    const observer = setupQuoteViewer() as TestMutationObserverInstance;

    expect(article.querySelectorAll(".quoted-tweets-container")).toHaveLength(
      1
    );
    expect(observer.observedTarget).toBe(asElement(doc.body));
  });

  test("processes newly inserted articles and nested articles", () => {
    const doc = createTestDocument();
    installGlobals(doc);
    const viewer = createQuoteViewer(asDocument(doc), asObserver());
    const direct = createArticle({ href: "/jack/status/1" }).article;
    const wrapper = doc.createElement("div");
    const nested = createArticle({ href: "/jack/status/2" }).article;
    wrapper.append(nested);

    viewer.processMutations([mutationWith([direct, wrapper, { nodeType: 3 }])]);

    expect(direct.querySelectorAll(".quoted-tweets-container")).toHaveLength(1);
    expect(nested.querySelectorAll(".quoted-tweets-container")).toHaveLength(1);
  });

  test("attaches an icon when a pending article later receives a group", () => {
    const { article, doc } = createArticle({
      href: "/jack/status/12345",
      includeGroup: false,
    });
    installGlobals(doc);
    const viewer = createQuoteViewer(asDocument(doc), asObserver());
    viewer.trySetIcon(asElement(article));

    const group = doc.createElement("div");
    group.setAttribute("role", "group");
    article.append(group);
    viewer.processMutations([mutationWith([group])]);

    expect(article.querySelectorAll(".quoted-tweets-container")).toHaveLength(
      1
    );
  });

  test("finds nested groups added to a pending article", () => {
    const { article, doc } = createArticle({
      href: "/jack/status/12345",
      includeGroup: false,
    });
    installGlobals(doc);
    const viewer = createQuoteViewer(asDocument(doc), asObserver());
    viewer.trySetIcon(asElement(article));

    const wrapper = doc.createElement("div");
    const group = doc.createElement("div");
    group.setAttribute("role", "group");
    wrapper.append(group);
    article.append(wrapper);
    viewer.processMutations([mutationWith([wrapper])]);

    expect(article.querySelectorAll(".quoted-tweets-container")).toHaveLength(
      1
    );
  });
});

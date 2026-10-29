import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { ContentScriptContext } from "wxt/utils/content-script-context";

import contentScript from "../src/entrypoints/content/index";

const originalGlobals = {
  CustomEvent: globalThis.CustomEvent,
  Element: globalThis.Element,
  Event: globalThis.Event,
  HTMLElement: globalThis.HTMLElement,
  MutationObserver: globalThis.MutationObserver,
  Node: globalThis.Node,
  PopStateEvent: globalThis.PopStateEvent,
  window: globalThis.window,
};

let testWindow: Window;
let context: ContentScriptContext;

const installWindow = (): void => {
  testWindow = new Window({ url: "https://x.com" });
  Object.defineProperties(globalThis, {
    CustomEvent: { configurable: true, value: testWindow.CustomEvent },
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
  context = new ContentScriptContext("quote-viewer-test");
};

const restoreWindow = (): void => {
  context.notifyInvalidated();

  testWindow.close();
  Object.defineProperties(globalThis, {
    CustomEvent: { configurable: true, value: originalGlobals.CustomEvent },
    Element: { configurable: true, value: originalGlobals.Element },
    Event: { configurable: true, value: originalGlobals.Event },
    HTMLElement: { configurable: true, value: originalGlobals.HTMLElement },
    MutationObserver: {
      configurable: true,
      value: originalGlobals.MutationObserver,
    },
    Node: { configurable: true, value: originalGlobals.Node },
    PopStateEvent: { configurable: true, value: originalGlobals.PopStateEvent },
    window: { configurable: true, value: originalGlobals.window },
  });
  Reflect.deleteProperty(globalThis, "document");
};

const createArticle = (): HTMLElement => {
  const article = document.createElement("article");
  const group = document.createElement("div");
  group.setAttribute("role", "group");
  article.append(group);

  return article;
};

describe("content script lifecycle", () => {
  afterEach(restoreWindow);

  it("disconnects its DOM observer when WXT invalidates the script", async () => {
    installWindow();
    contentScript.main(context);

    const articleBeforeInvalidation = createArticle();
    document.body.append(articleBeforeInvalidation);
    await testWindow.happyDOM.waitUntilComplete();

    expect(
      articleBeforeInvalidation.querySelector(".quoted-tweets-container")
    ).not.toBeNull();

    context.notifyInvalidated();

    const articleAfterInvalidation = createArticle();
    document.body.append(articleAfterInvalidation);
    await testWindow.happyDOM.waitUntilComplete();

    expect(
      articleAfterInvalidation.querySelector(".quoted-tweets-container")
    ).toBeNull();
  });
});

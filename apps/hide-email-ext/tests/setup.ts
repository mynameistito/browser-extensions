import { GlobalWindow } from "happy-dom";
import { fakeBrowser } from "wxt/testing/fake-browser";

const window = new GlobalWindow();

Object.defineProperties(globalThis, {
  CustomEvent: { configurable: true, value: window.CustomEvent },
  DOMParser: { configurable: true, value: window.DOMParser },
  Document: { configurable: true, value: window.Document },
  DocumentFragment: { configurable: true, value: window.DocumentFragment },
  Element: { configurable: true, value: window.Element },
  Event: { configurable: true, value: window.Event },
  HTMLElement: { configurable: true, value: window.HTMLElement },
  MutationObserver: { configurable: true, value: window.MutationObserver },
  Node: { configurable: true, value: window.Node },
  NodeFilter: { configurable: true, value: window.NodeFilter },
  Range: { configurable: true, value: window.Range },
  ResizeObserver: { configurable: true, value: window.ResizeObserver },
  Selection: { configurable: true, value: window.Selection },
  Text: { configurable: true, value: window.Text },
  TreeWalker: { configurable: true, value: window.TreeWalker },
  document: { configurable: true, value: window.document },
  window: { configurable: true, value: window },
});

const ric = (task: () => void): ReturnType<typeof setTimeout> =>
  setTimeout(task, 0);

const cic = (id: ReturnType<typeof setTimeout>): void => {
  clearTimeout(id);
};

Object.defineProperties(window, {
  cancelIdleCallback: { configurable: true, value: cic },
  requestIdleCallback: { configurable: true, value: ric },
});

Object.defineProperties(globalThis, {
  browser: { configurable: true, value: fakeBrowser },
  cancelIdleCallback: { configurable: true, value: cic },
  requestIdleCallback: { configurable: true, value: ric },
});

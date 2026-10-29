// DOM environment shared by content-script and offscreen tests.
// Loaded before source modules so happy-dom globals are available on import.

import { Window as HappyWindow } from "happy-dom";

const happyWindow = new HappyWindow({ url: "https://localhost/" });

// happy-dom v20's SelectorParser reads these from `this.window.*`.
Object.assign(happyWindow, {
  DOMException,
  Error,
  RangeError,
  SyntaxError,
  TypeError,
});

Object.assign(globalThis, {
  Event: happyWindow.Event,
  EventTarget: happyWindow.EventTarget,
  HTMLElement: happyWindow.HTMLElement,
  HTMLVideoElement: happyWindow.HTMLVideoElement,
  Node: happyWindow.Node,
  document: happyWindow.document,
  window: happyWindow,
});

// MutationObserver that reliably fires on DOM insertions across platforms
// (happy-dom's native impl is flaky on Linux CI). Limited to childList
// insertions, which is all this codebase requires.
interface TestMutationRecord {
  addedNodes: Node[];
}

type TestMutationCallback = (
  records: TestMutationRecord[],
  observer: TestMutationObserver
) => void;

class TestMutationObserver {
  private readonly _handleMutations: TestMutationCallback;
  private readonly _patched = new WeakSet<Node>();
  private _disconnected = false;

  constructor(handleMutations: TestMutationCallback) {
    this._handleMutations = handleMutations;
  }

  get disconnected(): boolean {
    return this._disconnected;
  }

  observe(target: Node, options?: MutationObserverInit) {
    this._patchInsertionMethods(target);

    if (options?.subtree === true) {
      const walk = (node: Node) => {
        for (const child of node.childNodes) {
          if (child.nodeType === 1) {
            this._patchInsertionMethods(child);
            walk(child);
          }
        }
      };

      walk(target);
    }
  }

  private _patchInsertionMethods(node: Node) {
    if (this._patched.has(node)) {
      return;
    }

    this._patched.add(node);

    const fireCallback = (addedNodes: Node[]) => {
      queueMicrotask(() => {
        if (this._disconnected) {
          return;
        }

        this._handleMutations([{ addedNodes }], this);
      });
    };

    const patchNewSubtree = (n: Node) => {
      if (n.nodeType === 1) {
        this._patchInsertionMethods(n);

        for (const child of n.childNodes) {
          patchNewSubtree(child);
        }
      }
    };

    const origAppendChild = node.appendChild.bind(node);
    node.appendChild = <T extends Node>(child: T): T => {
      const result = origAppendChild(child);
      fireCallback([child]);
      patchNewSubtree(child);

      return result;
    };

    const origInsertBefore = node.insertBefore.bind(node);
    node.insertBefore = <T extends Node>(child: T, ref: Node | null): T => {
      const result = origInsertBefore(child, ref);
      fireCallback([child]);
      patchNewSubtree(child);

      return result;
    };

    const origReplaceChild = node.replaceChild.bind(node);
    node.replaceChild = <T extends Node>(child: Node, old: T): T => {
      const result = origReplaceChild(child, old);
      fireCallback([child]);
      patchNewSubtree(child);

      return result;
    };

    if (node instanceof HTMLElement) {
      const origAppend = node.append.bind(node);
      node.append = (...nodes: (string | Node)[]): void => {
        origAppend(...nodes);
        const added = nodes.filter((n): n is Node => n instanceof Node);

        if (added.length > 0) {
          fireCallback(added);

          for (const n of added) {
            patchNewSubtree(n);
          }
        }
      };
    }

    if (node instanceof HTMLElement) {
      const origPrepend = node.prepend.bind(node);
      node.prepend = (...nodes: (string | Node)[]): void => {
        origPrepend(...nodes);
        const added = nodes.filter((n): n is Node => n instanceof Node);

        if (added.length > 0) {
          fireCallback(added);

          for (const n of added) {
            patchNewSubtree(n);
          }
        }
      };
    }
  }

  disconnect() {
    this._disconnected = true;
  }

  takeRecords() {
    if (this._disconnected) {
      return [];
    }

    return [];
  }
}

Object.assign(globalThis, { MutationObserver: TestMutationObserver });

Object.assign(happyWindow, { MutationObserver: TestMutationObserver });

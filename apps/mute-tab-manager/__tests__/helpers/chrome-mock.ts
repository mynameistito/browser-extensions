// Chrome API mock for Bun tests.
// Installed as a preload script so global.chrome is set before any source
// module loads. Also installs DOM globals via happy-dom for content-script
// and offscreen tests.

import { Window as HappyWindow } from "happy-dom";

const happyWindow = new HappyWindow({ url: "https://localhost/" });

// happy-dom v20's SelectorParser reads these from `this.window.*`.
(happyWindow as unknown as Record<string, unknown>).SyntaxError = SyntaxError;
(happyWindow as unknown as Record<string, unknown>).TypeError = TypeError;
(happyWindow as unknown as Record<string, unknown>).RangeError = RangeError;
(happyWindow as unknown as Record<string, unknown>).Error = Error;
(happyWindow as unknown as Record<string, unknown>).DOMException = DOMException;

const g = globalThis as Record<string, unknown>;
g.window = happyWindow;
g.document = happyWindow.document;
g.HTMLElement = happyWindow.HTMLElement;
g.HTMLVideoElement = happyWindow.HTMLVideoElement;
g.Node = happyWindow.Node;
g.EventTarget = happyWindow.EventTarget;
g.Event = happyWindow.Event;

// MutationObserver that reliably fires on DOM insertions across platforms
// (happy-dom's native impl is flaky on Linux CI). Limited to childList
// insertions, which is all this codebase requires.
class TestMutationObserver {
  private readonly _handleMutations: MutationCallback;
  private readonly _patched = new WeakSet<Node>();
  private _disconnected = false;

  constructor(handleMutations: MutationCallback) {
    this._handleMutations = handleMutations;
  }

  get disconnected(): boolean {
    return this._disconnected;
  }

  observe(target: Node, options?: MutationObserverInit) {
    this._patchInsertionMethods(target);

    if (options?.subtree) {
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

    const handleMutations = this._handleMutations;
    const observer = this as unknown as MutationObserver;

    const fireCallback = (addedNodes: Node[], removedNodes: Node[] = []) => {
      queueMicrotask(() => {
        if (this._disconnected) {
          return;
        }
        handleMutations(
          [
            {
              addedNodes: addedNodes as unknown as NodeList,
              attributeName: null,
              attributeNamespace: null,
              nextSibling: null,
              oldValue: null,
              previousSibling: null,
              removedNodes: removedNodes as unknown as NodeList,
              target: node,
              type: "childList",
            } as unknown as MutationRecord,
          ],
          observer
        );
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
      fireCallback([child], [old]);
      patchNewSubtree(child);
      return result;
    };

    if ("append" in node && typeof node.append === "function") {
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

    if ("prepend" in node && typeof node.prepend === "function") {
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

g.MutationObserver = TestMutationObserver;
(happyWindow as unknown as Record<string, unknown>).MutationObserver =
  TestMutationObserver;

interface MockEventBase {
  _listeners: unknown[];
}

type MockListener = (...args: never[]) => unknown;

interface MockEvent<TCallback extends MockListener> extends MockEventBase {
  _listeners: TCallback[];
  addListener: (listener: TCallback) => void;
  clearListeners: () => void;
  fire: (...args: Parameters<TCallback>) => Promise<void>;
  removeListener: (listener: TCallback) => void;
}

const createMockEvent = <
  TCallback extends MockListener,
>(): MockEvent<TCallback> => {
  const listeners: TCallback[] = [];
  return {
    _listeners: listeners,
    addListener(listener: TCallback) {
      listeners.push(listener);
    },
    clearListeners() {
      listeners.length = 0;
    },
    async fire(...args: Parameters<TCallback>) {
      await Promise.all(
        listeners.map((listener) =>
          (listener as unknown as (...a: unknown[]) => unknown)(...args)
        )
      );
    },
    removeListener(listener: TCallback) {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) {
        listeners.splice(idx, 1);
      }
    },
  };
};

let sessionStore: Record<string, unknown> = {};

export const mockConfig = {
  action: {
    setIconRejectTimes: 0,
  },
  runtime: {
    getContextsResult: [] as Partial<chrome.runtime.ExtensionContext>[],
  },
  tabs: {
    getResult: {
      id: 1,
      mutedInfo: { muted: false },
    } as Partial<chrome.tabs.Tab>,
    queryResult: [] as Partial<chrome.tabs.Tab>[],
    sendMessageShouldReject: false,
  },
};

export const mockCalls = {
  action: {
    setBadgeBackgroundColor: [] as chrome.action.BadgeColorDetails[],
    setBadgeText: [] as chrome.action.BadgeTextDetails[],
    setIcon: [] as chrome.action.TabIconDetails[],
  },
  contextMenus: {
    create: [] as chrome.contextMenus.CreateProperties[],
  },
  offscreen: {
    createDocument: [] as chrome.offscreen.CreateParameters[],
  },
  runtime: {
    getContexts: [] as chrome.runtime.ContextFilter[],
    sendMessage: [] as unknown[],
  },
  tabs: {
    get: [] as number[],
    query: [] as chrome.tabs.QueryInfo[],
    sendMessage: [] as [number, unknown][],
    update: [] as [number, chrome.tabs.UpdateProperties][],
  },
};

export const mockEvents = {
  action: {
    onClicked: createMockEvent<(tab: chrome.tabs.Tab) => void>(),
  },
  commands: {
    onCommand: createMockEvent<(command: string) => void>(),
  },
  contextMenus: {
    onClicked:
      createMockEvent<
        (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void
      >(),
  },
  runtime: {
    onInstalled:
      createMockEvent<(details: chrome.runtime.InstalledDetails) => void>(),
    onMessage:
      createMockEvent<
        (
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (r?: unknown) => void
        ) => void
      >(),
  },
  tabs: {
    onActivated:
      createMockEvent<
        (activeInfo: { tabId: number; windowId: number }) => void
      >(),
    onRemoved:
      createMockEvent<
        (
          tabId: number,
          removeInfo: { windowId: number; isWindowClosing: boolean }
        ) => void
      >(),
    onUpdated:
      createMockEvent<
        (
          tabId: number,
          changeInfo: { status?: string; url?: string },
          tab: chrome.tabs.Tab
        ) => void
      >(),
  },
};

/**
 * Snapshot the current listeners on all mock events. Use with `listenerDelta`
 * to isolate listeners registered by a single module under test.
 */
export const snapshotListeners = (): Map<MockEventBase, unknown[]> => {
  const snap = new Map<MockEventBase, unknown[]>();
  for (const group of Object.values(mockEvents)) {
    for (const event of Object.values(group) as MockEventBase[]) {
      snap.set(event, [...event._listeners]);
    }
  }
  return snap;
};

/** Compute the listeners added between two snapshots (after - before). */
export const listenerDelta = (
  before: Map<MockEventBase, unknown[]>,
  after: Map<MockEventBase, unknown[]>
): Map<MockEventBase, unknown[]> => {
  const delta = new Map<MockEventBase, unknown[]>();
  for (const [event, afterListeners] of after) {
    const beforeCount = before.get(event)?.length ?? 0;
    delta.set(event, afterListeners.slice(beforeCount));
  }
  return delta;
};

/** Clear all listeners then restore only those in the given snapshot. */
export const restoreListeners = (snap: Map<MockEventBase, unknown[]>): void => {
  for (const group of Object.values(mockEvents)) {
    for (const event of Object.values(group) as MockEventBase[]) {
      event._listeners.length = 0;
    }
  }
  for (const [event, listeners] of snap) {
    event._listeners.push(...listeners);
  }
};

export const resetChromeMock = (): void => {
  sessionStore = {};
  mockCalls.action.setBadgeText.length = 0;
  mockCalls.action.setBadgeBackgroundColor.length = 0;
  mockCalls.action.setIcon.length = 0;
  mockCalls.tabs.update.length = 0;
  mockCalls.tabs.sendMessage.length = 0;
  mockCalls.tabs.get.length = 0;
  mockCalls.tabs.query.length = 0;
  mockCalls.runtime.sendMessage.length = 0;
  mockCalls.contextMenus.create.length = 0;
  mockCalls.offscreen.createDocument.length = 0;
  mockCalls.runtime.getContexts.length = 0;

  mockConfig.tabs.getResult = { id: 1, mutedInfo: { muted: false } };
  mockConfig.tabs.queryResult = [];
  mockConfig.action.setIconRejectTimes = 0;
  mockConfig.tabs.sendMessageShouldReject = false;
  mockConfig.runtime.getContextsResult = [];
};

const chromeMock = {
  action: {
    onClicked: mockEvents.action.onClicked,
    setBadgeBackgroundColor: (details: chrome.action.BadgeColorDetails) => {
      mockCalls.action.setBadgeBackgroundColor.push(details);
    },
    setBadgeText: (details: chrome.action.BadgeTextDetails) => {
      mockCalls.action.setBadgeText.push(details);
    },
    setIcon: (details: chrome.action.TabIconDetails) => {
      mockCalls.action.setIcon.push(details);
      if (mockConfig.action.setIconRejectTimes > 0) {
        mockConfig.action.setIconRejectTimes -= 1;
        return Promise.reject(new Error("setIcon failed"));
      }
      return Promise.resolve();
    },
  },
  commands: {
    onCommand: mockEvents.commands.onCommand,
  },
  contextMenus: {
    create: (properties: chrome.contextMenus.CreateProperties) => {
      mockCalls.contextMenus.create.push(properties);
    },
    onClicked: mockEvents.contextMenus.onClicked,
  },
  offscreen: {
    Reason: {
      MATCH_MEDIA: "MATCH_MEDIA",
    },
    createDocument: (params: chrome.offscreen.CreateParameters) => {
      mockCalls.offscreen.createDocument.push(params);
      return Promise.resolve();
    },
  },
  runtime: {
    ContextType: {
      OFFSCREEN_DOCUMENT: "OFFSCREEN_DOCUMENT",
    },
    getContexts: (filter: chrome.runtime.ContextFilter) => {
      mockCalls.runtime.getContexts.push(filter);
      return Promise.resolve(mockConfig.runtime.getContextsResult);
    },
    onInstalled: mockEvents.runtime.onInstalled,
    onMessage: mockEvents.runtime.onMessage,
    sendMessage: (message: unknown) => {
      mockCalls.runtime.sendMessage.push(message);
      return Promise.resolve();
    },
  },
  storage: {
    session: {
      get: (keys?: string | string[] | Record<string, unknown> | null) => {
        if (keys === null || keys === undefined) {
          return Promise.resolve({ ...sessionStore });
        }
        let keyArr: string[];
        let keysObj: Record<string, unknown> | undefined;
        if (typeof keys === "string") {
          keyArr = [keys];
        } else if (Array.isArray(keys)) {
          keyArr = keys;
        } else {
          keysObj = keys;
          keyArr = Object.keys(keys);
        }
        const result: Record<string, unknown> = {};
        for (const k of keyArr) {
          result[k] = Object.hasOwn(sessionStore, k)
            ? sessionStore[k]
            : keysObj?.[k];
        }
        return Promise.resolve(result);
      },
      set: (items: Record<string, unknown>) => {
        Object.assign(sessionStore, items);
        return Promise.resolve();
      },
    },
  },
  tabs: {
    get: (tabId: number) => {
      mockCalls.tabs.get.push(tabId);
      return Promise.resolve(mockConfig.tabs.getResult as chrome.tabs.Tab);
    },
    onActivated: mockEvents.tabs.onActivated,
    onRemoved: mockEvents.tabs.onRemoved,
    onUpdated: mockEvents.tabs.onUpdated,
    query: (queryInfo: chrome.tabs.QueryInfo) => {
      mockCalls.tabs.query.push(queryInfo);
      return Promise.resolve(mockConfig.tabs.queryResult as chrome.tabs.Tab[]);
    },
    sendMessage: (tabId: number, message: unknown) => {
      mockCalls.tabs.sendMessage.push([tabId, message]);
      if (mockConfig.tabs.sendMessageShouldReject) {
        return Promise.reject(new Error("sendMessage failed"));
      }
      return Promise.resolve();
    },
    update: (tabId: number, props: chrome.tabs.UpdateProperties) => {
      mockCalls.tabs.update.push([tabId, props]);
      return Promise.resolve(mockConfig.tabs.getResult as chrome.tabs.Tab);
    },
  },
};

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

// Stub WXT auto-imports used by entrypoints when imported directly under test.
(
  globalThis as unknown as {
    defineBackground: (def: { main: () => void } | { main: () => void }) => {
      main: () => void;
    };
  }
).defineBackground = (def) => def;

(
  globalThis as unknown as {
    defineContentScript: (def: { main: () => void }) => { main: () => void };
  }
).defineContentScript = (def) => def;

// Minimal import.meta.env.BROWSER shim for tests
interface ImportMetaEnv {
  BROWSER?: string;
}
interface ImportMetaWithEnv {
  env?: ImportMetaEnv;
}
const meta = import.meta as unknown as ImportMetaWithEnv & {
  env: ImportMetaEnv;
};
meta.env ??= {};
meta.env.BROWSER ??= "chrome";

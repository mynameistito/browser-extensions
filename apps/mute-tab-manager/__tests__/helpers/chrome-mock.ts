// Chrome API mock for Bun tests.
// Installed as a preload script so global.chrome is set before any source
// module loads. Also installs DOM globals via happy-dom for content-script
// and offscreen tests.

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

interface MockEventBase {
  _listeners: MockListener[];
}

type MockListener = (...args: never[]) => void | Promise<void>;

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
        listeners.map(async (listener) => {
          await Promise.resolve();
          const result = listener(...args);

          if (result instanceof Promise) {
            await result;
          }
        })
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

type SessionValue = boolean | Record<string, boolean>;

type SessionStore = Record<string, SessionValue>;

interface MockMessage {
  readonly isDark?: boolean;
  readonly muted?: boolean;
  readonly type: string;
}

interface MockIconDetails {
  path: Record<string, string>;
  tabId: number;
}

interface MockTab {
  id?: number;
  mutedInfo?: chrome.tabs.MutedInfo;
  title?: string;
}

const createList = <T>(): T[] => [];
const emptyContexts: chrome.runtime.ExtensionContext[] = [];
const defaultMockTab: MockTab = { id: 1, mutedInfo: { muted: false } };

let sessionStore: SessionStore = {};

export const mockConfig = {
  action: {
    setIconRejectTimes: 0,
  },
  runtime: {
    getContextsResult: emptyContexts,
  },
  tabs: {
    getResult: defaultMockTab,
    queryResult: createList<MockTab>(),
    sendMessageShouldReject: false,
  },
};

export const mockCalls = {
  action: {
    setBadgeBackgroundColor: createList<chrome.action.BadgeColorDetails>(),
    setBadgeText: createList<chrome.action.BadgeTextDetails>(),
    setIcon: createList<MockIconDetails>(),
  },
  contextMenus: {
    create: createList<chrome.contextMenus.CreateProperties>(),
  },
  offscreen: {
    createDocument: createList<chrome.offscreen.CreateParameters>(),
  },
  runtime: {
    getContexts: createList<chrome.runtime.ContextFilter>(),
    sendMessage: createList<MockMessage>(),
  },
  tabs: {
    get: createList<number>(),
    query: createList<chrome.tabs.QueryInfo>(),
    sendMessage: createList<[number, MockMessage]>(),
    update: createList<[number, chrome.tabs.UpdateProperties]>(),
  },
};

export const mockEvents = {
  action: {
    onClicked: createMockEvent<(tab: MockTab) => void>(),
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
          message: MockMessage,
          sender: chrome.runtime.MessageSender,
          sendResponse: (r?: MockMessage) => void
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
          tab: MockTab
        ) => void
      >(),
  },
};

const allMockEvents: MockEventBase[] = [
  mockEvents.action.onClicked,
  mockEvents.commands.onCommand,
  mockEvents.contextMenus.onClicked,
  mockEvents.runtime.onInstalled,
  mockEvents.runtime.onMessage,
  mockEvents.tabs.onActivated,
  mockEvents.tabs.onRemoved,
  mockEvents.tabs.onUpdated,
];

/**
 * Snapshots all mock event listeners.
 *
 * @returns A copy of each mock event's listeners.
 */
export const snapshotListeners = (): Map<MockEventBase, MockListener[]> => {
  const snap = new Map<MockEventBase, MockListener[]>();

  for (const event of allMockEvents) {
    snap.set(event, [...event._listeners]);
  }

  return snap;
};

/**
 * Computes the listeners added between two snapshots.
 *
 * @param before - The earlier listener snapshot.
 * @param after - The later listener snapshot.
 * @returns The listeners added since the earlier snapshot.
 */
export const listenerDelta = (
  before: Map<MockEventBase, MockListener[]>,
  after: Map<MockEventBase, MockListener[]>
): Map<MockEventBase, MockListener[]> => {
  const delta = new Map<MockEventBase, MockListener[]>();

  for (const [event, afterListeners] of after) {
    const beforeCount = before.get(event)?.length ?? 0;
    delta.set(event, afterListeners.slice(beforeCount));
  }

  return delta;
};

/**
 * Restores mock events to a previously captured listener snapshot.
 *
 * @param snap - The listener snapshot to restore.
 */
export const restoreListeners = (
  snap: Map<MockEventBase, MockListener[]>
): void => {
  for (const event of allMockEvents) {
    event._listeners.length = 0;
  }

  for (const [event, listeners] of snap) {
    event._listeners.push(...listeners);
  }
};

/** Resets recorded API calls, configuration, and session storage between tests. */
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
    setIcon: async (details: MockIconDetails) => {
      mockCalls.action.setIcon.push(details);

      await Promise.resolve();

      if (mockConfig.action.setIconRejectTimes > 0) {
        mockConfig.action.setIconRejectTimes -= 1;

        throw new Error("setIcon failed");
      }
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
    createDocument: async (params: chrome.offscreen.CreateParameters) => {
      mockCalls.offscreen.createDocument.push(params);

      await Promise.resolve();
    },
  },
  runtime: {
    ContextType: {
      OFFSCREEN_DOCUMENT: "OFFSCREEN_DOCUMENT",
    },
    getContexts: async (filter: chrome.runtime.ContextFilter) => {
      mockCalls.runtime.getContexts.push(filter);

      await Promise.resolve();

      return mockConfig.runtime.getContextsResult;
    },
    getURL: (path: string) => path,
    onInstalled: mockEvents.runtime.onInstalled,
    onMessage: mockEvents.runtime.onMessage,
    sendMessage: async (message: MockMessage) => {
      mockCalls.runtime.sendMessage.push(message);

      await Promise.resolve();
    },
  },
  storage: {
    session: {
      get: async (key: string) => {
        await Promise.resolve();
        const result: SessionStore = {};

        if (Object.hasOwn(sessionStore, key)) {
          result[key] = sessionStore[key] ?? false;
        }

        return result;
      },
      set: async (items: SessionStore) => {
        Object.assign(sessionStore, items);

        await Promise.resolve();
      },
    },
  },
  tabs: {
    get: async (tabId: number) => {
      mockCalls.tabs.get.push(tabId);

      await Promise.resolve();

      return mockConfig.tabs.getResult;
    },
    onActivated: mockEvents.tabs.onActivated,
    onRemoved: mockEvents.tabs.onRemoved,
    onUpdated: mockEvents.tabs.onUpdated,
    query: async (queryInfo: chrome.tabs.QueryInfo) => {
      mockCalls.tabs.query.push(queryInfo);

      await Promise.resolve();

      return mockConfig.tabs.queryResult;
    },
    sendMessage: async (tabId: number, message: MockMessage) => {
      mockCalls.tabs.sendMessage.push([tabId, message]);

      await Promise.resolve();

      if (mockConfig.tabs.sendMessageShouldReject) {
        throw new Error("sendMessage failed");
      }
    },
    update: async (tabId: number, props: chrome.tabs.UpdateProperties) => {
      mockCalls.tabs.update.push([tabId, props]);

      await Promise.resolve();

      return mockConfig.tabs.getResult;
    },
  },
};

Reflect.set(globalThis, "chrome", chromeMock);

// Stub WXT auto-imports used by entrypoints when imported directly under test.
Reflect.set(
  globalThis,
  "defineBackground",
  (definition: { main: () => void }) => definition
);

Reflect.set(
  globalThis,
  "defineContentScript",
  (definition: { main: () => void }) => definition
);

Reflect.set(import.meta, "env", { BROWSER: "chrome" });

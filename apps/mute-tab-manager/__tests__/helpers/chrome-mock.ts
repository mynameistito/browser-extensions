// Chrome API mocks for tests.

import { mockEvents } from "./chrome-mock-events.ts";
import type { MockMessage, MockTab } from "./chrome-mock-events.ts";

type SessionValue = boolean | Record<string, boolean>;

type SessionStore = Record<string, SessionValue>;

interface MockIconDetails {
  path: Record<string, string>;
  tabId: number;
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

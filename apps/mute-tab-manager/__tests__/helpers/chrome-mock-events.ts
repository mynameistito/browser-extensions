// Chrome event mocks and listener snapshot utilities.

export interface MockMessage {
  readonly isDark?: boolean;
  readonly muted?: boolean;
  readonly type: string;
}

export interface MockTab {
  id?: number;
  mutedInfo?: chrome.tabs.MutedInfo;
  title?: string;
}

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

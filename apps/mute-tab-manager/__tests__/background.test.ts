import { setTimeout as delay } from "node:timers/promises";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockEvents,
  restoreListeners,
  snapshotListeners,
} from "@/tests/helpers/chrome-mock-events.ts";
import {
  mockCalls,
  mockConfig,
  resetChromeMock,
} from "@/tests/helpers/chrome-mock.ts";
import {
  COMMAND_TOGGLE_MUTE,
  CONTEXT_MENU_MUTE_ALL,
  CONTEXT_MENU_TOGGLE_ID,
} from "@/utils/constants.ts";
import { getMutedTabs } from "@/utils/storage.ts";

let backgroundListeners: ReturnType<typeof snapshotListeners>;

const flushAsyncListeners = async (): Promise<void> => {
  await delay(0);
};

describe("background entrypoint", () => {
  beforeAll(async () => {
    const before = snapshotListeners();
    const background = await import("@/entrypoints/background.ts");
    background.default.main();
    await flushAsyncListeners();
    backgroundListeners = snapshotListeners();
    restoreListeners(before);
    backgroundListeners = new Map(
      [...backgroundListeners].map(([event, listeners]) => [
        event,
        listeners.slice(before.get(event)?.length ?? 0),
      ])
    );
  });

  beforeEach(() => {
    resetChromeMock();
    restoreListeners(backgroundListeners);
  });

  it("creates an offscreen document when one is not already open", async () => {
    await mockEvents.runtime.onInstalled.fire({ reason: "install" });
    await flushAsyncListeners();

    expect(mockCalls.contextMenus.create.map(({ id }) => id)).toStrictEqual([
      CONTEXT_MENU_TOGGLE_ID,
      CONTEXT_MENU_MUTE_ALL,
    ]);
    expect(mockCalls.offscreen.createDocument).toHaveLength(1);
  });

  it("reuses an existing offscreen document", async () => {
    mockConfig.runtime.getContextsResult = [
      {
        contextId: "offscreen",
        contextType: chrome.runtime.ContextType.OFFSCREEN_DOCUMENT,
        frameId: -1,
        incognito: false,
        tabId: -1,
        windowId: -1,
      },
    ];

    await mockEvents.runtime.onInstalled.fire({ reason: "install" });
    await flushAsyncListeners();

    expect(mockCalls.offscreen.createDocument).toHaveLength(0);
    expect(mockCalls.runtime.sendMessage).toContainEqual({
      type: "GET_DARK_MODE",
    });
  });

  it("routes action clicks and the toggle command to the active tab", async () => {
    mockConfig.tabs.queryResult = [{ id: 7 }];
    mockConfig.tabs.getResult = { id: 7, mutedInfo: { muted: false } };

    await mockEvents.action.onClicked.fire({ id: 7 });
    await mockEvents.commands.onCommand.fire(COMMAND_TOGGLE_MUTE);
    await flushAsyncListeners();

    expect(mockCalls.tabs.update).toStrictEqual([
      [7, { muted: true }],
      [7, { muted: true }],
    ]);
  });

  it("routes context-menu actions to toggle and mute all", async () => {
    mockConfig.tabs.queryResult = [{ id: 4 }];
    mockConfig.tabs.getResult = { id: 4, mutedInfo: { muted: false } };

    await mockEvents.contextMenus.onClicked.fire({
      editable: false,
      menuItemId: CONTEXT_MENU_TOGGLE_ID,
    });
    await mockEvents.contextMenus.onClicked.fire({
      editable: false,
      menuItemId: CONTEXT_MENU_MUTE_ALL,
    });
    await flushAsyncListeners();

    expect(mockCalls.tabs.update).toContainEqual([4, { muted: true }]);
    await expect(getMutedTabs()).resolves.toStrictEqual({ 4: true });
  });

  it("updates active muted tabs after reload and SPA navigation", async () => {
    await chrome.storage.session.set({ mutedTabs: { 9: true } });

    await mockEvents.tabs.onUpdated.fire(
      9,
      { status: "complete", url: "https://youtube.com/watch" },
      { id: 9 }
    );
    await mockEvents.tabs.onActivated.fire({ tabId: 9, windowId: 1 });
    await flushAsyncListeners();

    expect(mockCalls.tabs.sendMessage).toHaveLength(2);
    expect(mockCalls.action.setBadgeText).toContainEqual({
      tabId: 9,
      text: "M",
    });
  });

  it("does not resend state for an unmuted tab or a non-complete update", async () => {
    await chrome.storage.session.set({ mutedTabs: { 11: true } });

    await mockEvents.tabs.onUpdated.fire(11, { status: "loading" }, { id: 11 });
    await flushAsyncListeners();

    expect(mockCalls.tabs.sendMessage).toHaveLength(0);
  });

  it("does not message an unmuted tab on navigation and removes closed tabs", async () => {
    await mockEvents.tabs.onUpdated.fire(
      10,
      { url: "https://example.com/" },
      { id: 10 }
    );
    await flushAsyncListeners();
    await chrome.storage.session.set({ mutedTabs: { 10: true } });
    await mockEvents.tabs.onRemoved.fire(10, {
      isWindowClosing: false,
      windowId: 1,
    });
    await flushAsyncListeners();

    expect(mockCalls.tabs.sendMessage).toHaveLength(0);
    await expect(getMutedTabs()).resolves.toStrictEqual({});
  });

  it("stores dark-mode responses from the offscreen document", async () => {
    await mockEvents.runtime.onMessage.fire(
      { type: "UNRELATED" },
      {},
      () => {}
    );
    await mockEvents.runtime.onMessage.fire(
      { isDark: true, type: "DARK_MODE_RESPONSE" },
      {},
      () => {}
    );
    await flushAsyncListeners();

    await expect(
      chrome.storage.session.get("isDarkMode")
    ).resolves.toStrictEqual({
      isDarkMode: true,
    });
  });

  it("detects Firefox dark-mode changes in the service worker", async () => {
    vi.stubEnv("BROWSER", "firefox");
    vi.resetModules();
    restoreListeners(
      new Map([...snapshotListeners()].map(([event]) => [event, []]))
    );
    const changes = new EventTarget();
    vi.stubGlobal("matchMedia", () => ({
      addEventListener: vi.fn<
        (type: string, listener: EventListenerOrEventListenerObject) => void
      >((type, listener) => {
        changes.addEventListener(type, listener);
      }),
      matches: true,
    }));

    const background = await import("@/entrypoints/background.ts");
    background.default.main();
    await flushAsyncListeners();

    changes.dispatchEvent(
      Object.assign(new Event("change"), { matches: false })
    );
    await mockEvents.runtime.onInstalled.fire({ reason: "install" });
    await flushAsyncListeners();

    await expect(
      chrome.storage.session.get("isDarkMode")
    ).resolves.toStrictEqual({
      isDarkMode: false,
    });
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("starts Firefox without matchMedia and handles storage write failures", async () => {
    vi.stubEnv("BROWSER", "firefox");
    vi.resetModules();
    restoreListeners(
      new Map([...snapshotListeners()].map(([event]) => [event, []]))
    );
    vi.stubGlobal("matchMedia", undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const background = await import("@/entrypoints/background.ts");
    background.default.main();
    await flushAsyncListeners();

    vi.spyOn(chrome.storage.session, "set").mockRejectedValueOnce(
      new Error("storage unavailable")
    );
    await mockEvents.runtime.onMessage.fire(
      { isDark: true, type: "DARK_MODE_RESPONSE" },
      {},
      () => {}
    );
    await flushAsyncListeners();

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: "storage unavailable" })
    );
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("logs failures from guarded event handlers", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockConfig.tabs.queryResult = [{ id: 1 }];
    vi.spyOn(chrome.tabs, "get").mockRejectedValueOnce(
      new Error("tab unavailable")
    );

    await mockEvents.action.onClicked.fire({ id: 1 });
    await flushAsyncListeners();

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: "tab unavailable" })
    );
  });

  it("ignores unrelated commands and context-menu entries", async () => {
    await mockEvents.commands.onCommand.fire("unrelated-command");
    await mockEvents.contextMenus.onClicked.fire({
      editable: false,
      menuItemId: "unrelated-entry",
    });
    await flushAsyncListeners();

    expect(mockCalls.tabs.update).toHaveLength(0);
  });
});

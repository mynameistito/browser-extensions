import { beforeEach, describe, expect, test } from "bun:test";

import {
  mockCalls,
  mockConfig,
  resetChromeMock,
} from "@/tests/helpers/chrome-mock.ts";
import {
  muteAllTabs,
  sendMuteToContentScript,
  toggleMuteActiveTab,
  toggleMuteTab,
} from "@/utils/mute.ts";
import { getMutedTabs, isTabMuted } from "@/utils/storage.ts";

beforeEach(() => {
  resetChromeMock();
});

describe("sendMuteToContentScript", () => {
  test("calls tabs.sendMessage with correct args", async () => {
    await sendMuteToContentScript(3, true);
    expect(mockCalls.tabs.sendMessage).toContainEqual([
      3,
      { muted: true, type: "SET_MUTED" },
    ]);
  });

  test("silently ignores rejection", async () => {
    mockConfig.tabs.sendMessageShouldReject = true;
    expect(await sendMuteToContentScript(3, true)).toBeUndefined();
  });
});

describe("toggleMuteTab", () => {
  test("toggles from unmuted to muted", async () => {
    mockConfig.tabs.getResult = { id: 1, mutedInfo: { muted: false } };
    await toggleMuteTab(1);
    expect(mockCalls.tabs.update).toContainEqual([1, { muted: true }]);
    expect(await isTabMuted(1)).toBe(true);
  });

  test("toggles from muted to unmuted", async () => {
    mockConfig.tabs.getResult = { id: 1, mutedInfo: { muted: true } };
    await toggleMuteTab(1);
    expect(mockCalls.tabs.update).toContainEqual([1, { muted: false }]);
    expect(await isTabMuted(1)).toBe(false);
  });

  test("defaults to false when mutedInfo is undefined", async () => {
    mockConfig.tabs.getResult = { id: 1 };
    await toggleMuteTab(1);
    expect(mockCalls.tabs.update).toContainEqual([1, { muted: true }]);
  });
});

describe("toggleMuteActiveTab", () => {
  test("calls toggleMuteTab with active tab id", async () => {
    mockConfig.tabs.queryResult = [{ id: 5, mutedInfo: { muted: false } }];
    mockConfig.tabs.getResult = { id: 5, mutedInfo: { muted: false } };
    await toggleMuteActiveTab();
    expect(mockCalls.tabs.update).toContainEqual([5, { muted: true }]);
  });

  test("no-op when query returns empty array", async () => {
    mockConfig.tabs.queryResult = [];
    await toggleMuteActiveTab();
    expect(mockCalls.tabs.update.length).toBe(0);
  });

  test("no-op when tab has no id", async () => {
    mockConfig.tabs.queryResult = [{ id: undefined, title: "No id tab" }];
    await toggleMuteActiveTab();
    expect(mockCalls.tabs.update.length).toBe(0);
  });
});

describe("muteAllTabs", () => {
  test("mutes all tabs with ids", async () => {
    mockConfig.tabs.queryResult = [
      { id: 1, mutedInfo: { muted: false } },
      { id: 2, mutedInfo: { muted: false } },
    ];
    await muteAllTabs();
    expect(mockCalls.tabs.update).toContainEqual([1, { muted: true }]);
    expect(mockCalls.tabs.update).toContainEqual([2, { muted: true }]);
  });

  test("writes batch storage update", async () => {
    mockConfig.tabs.queryResult = [
      { id: 1, mutedInfo: { muted: false } },
      { id: 2, mutedInfo: { muted: false } },
    ];
    await muteAllTabs();
    const result = await getMutedTabs();
    expect(result[1]).toBe(true);
    expect(result[2]).toBe(true);
  });

  test("skips tabs without id", async () => {
    mockConfig.tabs.queryResult = [
      { title: "no id" },
      { id: 3, mutedInfo: { muted: false } },
    ];
    await muteAllTabs();
    expect(mockCalls.tabs.update.length).toBe(1);
    expect(
      (mockCalls.tabs.update[0] as [number, chrome.tabs.UpdateProperties])[0]
    ).toBe(3);
  });
});

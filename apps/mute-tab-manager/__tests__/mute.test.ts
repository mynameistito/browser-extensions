import { it, describe, expect, beforeEach } from "vitest";

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

describe("mute utilities", () => {
  beforeEach(() => {
    resetChromeMock();
  });

  describe(sendMuteToContentScript, () => {
    it("calls tabs.sendMessage with correct args", async () => {
      await sendMuteToContentScript(3, true);
      expect(mockCalls.tabs.sendMessage).toContainEqual([
        3,
        { muted: true, type: "SET_MUTED" },
      ]);
    });

    it("silently ignores rejection", async () => {
      mockConfig.tabs.sendMessageShouldReject = true;
      await sendMuteToContentScript(3, true);
      expect(mockCalls.tabs.sendMessage).toHaveLength(1);
    });
  });

  describe(toggleMuteTab, () => {
    it("toggles from unmuted to muted", async () => {
      mockConfig.tabs.getResult = { id: 1, mutedInfo: { muted: false } };
      await toggleMuteTab(1);
      expect(mockCalls.tabs.update).toContainEqual([1, { muted: true }]);
      await expect(isTabMuted(1)).resolves.toBeTruthy();
    });

    it("toggles from muted to unmuted", async () => {
      mockConfig.tabs.getResult = { id: 1, mutedInfo: { muted: true } };
      await toggleMuteTab(1);
      expect(mockCalls.tabs.update).toContainEqual([1, { muted: false }]);
      await expect(isTabMuted(1)).resolves.toBeFalsy();
    });

    it("defaults to false when mutedInfo is undefined", async () => {
      mockConfig.tabs.getResult = { id: 1 };
      await toggleMuteTab(1);
      expect(mockCalls.tabs.update).toContainEqual([1, { muted: true }]);
    });
  });

  describe(toggleMuteActiveTab, () => {
    it("calls toggleMuteTab with active tab id", async () => {
      mockConfig.tabs.queryResult = [{ id: 5, mutedInfo: { muted: false } }];
      mockConfig.tabs.getResult = { id: 5, mutedInfo: { muted: false } };
      await toggleMuteActiveTab();
      expect(mockCalls.tabs.update).toContainEqual([5, { muted: true }]);
    });

    it("no-op when query returns empty array", async () => {
      mockConfig.tabs.queryResult = [];
      await toggleMuteActiveTab();
      expect(mockCalls.tabs.update).toHaveLength(0);
    });

    it("no-op when tab has no id", async () => {
      mockConfig.tabs.queryResult = [{ title: "No id tab" }];
      await toggleMuteActiveTab();
      expect(mockCalls.tabs.update).toHaveLength(0);
    });
  });

  describe(muteAllTabs, () => {
    it("mutes all tabs with ids", async () => {
      mockConfig.tabs.queryResult = [
        { id: 1, mutedInfo: { muted: false } },
        { id: 2, mutedInfo: { muted: false } },
      ];
      await muteAllTabs();
      expect(mockCalls.tabs.update).toContainEqual([1, { muted: true }]);
      expect(mockCalls.tabs.update).toContainEqual([2, { muted: true }]);
    });

    it("writes batch storage update", async () => {
      mockConfig.tabs.queryResult = [
        { id: 1, mutedInfo: { muted: false } },
        { id: 2, mutedInfo: { muted: false } },
      ];
      await muteAllTabs();
      const result = await getMutedTabs();
      expect(result[1]).toBeTruthy();
      expect(result[2]).toBeTruthy();
    });

    it("skips tabs without id", async () => {
      mockConfig.tabs.queryResult = [
        { title: "no id" },
        { id: 3, mutedInfo: { muted: false } },
      ];
      await muteAllTabs();
      expect(mockCalls.tabs.update).toHaveLength(1);
      expect(mockCalls.tabs.update[0]?.[0]).toBe(3);
    });
  });
});

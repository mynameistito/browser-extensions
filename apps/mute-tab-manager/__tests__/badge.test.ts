import { beforeEach, describe, expect, test } from "bun:test";

import {
  mockCalls,
  mockConfig,
  resetChromeMock,
} from "@/tests/helpers/chrome-mock.ts";
import { updateBadgeAndIcon } from "@/utils/badge.ts";
import {
  BADGE_COLOR_MUTED,
  BADGE_COLOR_UNMUTED,
  BADGE_MUTED,
  BADGE_UNMUTED,
} from "@/utils/constants.ts";

beforeEach(() => {
  resetChromeMock();
});

describe("updateBadgeAndIcon", () => {
  test("sets badge text to 'M' when muted", async () => {
    await updateBadgeAndIcon(1, true);
    expect(mockCalls.action.setBadgeText).toContainEqual({
      tabId: 1,
      text: BADGE_MUTED,
    });
  });

  test("sets badge text to '' when unmuted", async () => {
    await updateBadgeAndIcon(1, false);
    expect(mockCalls.action.setBadgeText).toContainEqual({
      tabId: 1,
      text: BADGE_UNMUTED,
    });
  });

  test("sets red color when muted", async () => {
    await updateBadgeAndIcon(1, true);
    expect(mockCalls.action.setBadgeBackgroundColor).toContainEqual({
      color: BADGE_COLOR_MUTED,
      tabId: 1,
    });
  });

  test("sets green color when unmuted", async () => {
    await updateBadgeAndIcon(1, false);
    expect(mockCalls.action.setBadgeBackgroundColor).toContainEqual({
      color: BADGE_COLOR_UNMUTED,
      tabId: 1,
    });
  });

  test("uses muted-light icon paths in light mode when muted", async () => {
    await updateBadgeAndIcon(1, true);
    expect(mockCalls.action.setIcon.length).toBeGreaterThan(0);
    const call = mockCalls.action.setIcon[0] as chrome.action.TabIconDetails;
    expect((call.path as Record<string, string>)["16"]).toContain(
      "muted-light"
    );
  });

  test("uses unmuted-dark icon paths in dark mode when unmuted", async () => {
    await chrome.storage.session.set({ isDarkMode: true });
    await updateBadgeAndIcon(1, false);
    const call = mockCalls.action.setIcon[0] as chrome.action.TabIconDetails;
    expect((call.path as Record<string, string>)["16"]).toContain(
      "unmuted-dark"
    );
  });

  test("falls back to base icons when setIcon rejects on first call", async () => {
    mockConfig.action.setIconRejectTimes = 1;
    await updateBadgeAndIcon(1, true);
    expect(mockCalls.action.setIcon.length).toBe(2);
    const fallback = mockCalls.action
      .setIcon[1] as chrome.action.TabIconDetails;
    expect((fallback.path as Record<string, string>)["16"]).toBe(
      "icons/icon-16.png"
    );
  });
});

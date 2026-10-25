import { it, describe, expect, beforeEach } from "vitest";

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

describe(updateBadgeAndIcon, () => {
  beforeEach(() => {
    resetChromeMock();
  });

  it("sets badge text to 'M' when muted", async () => {
    await updateBadgeAndIcon(1, true);
    expect(mockCalls.action.setBadgeText).toContainEqual({
      tabId: 1,
      text: BADGE_MUTED,
    });
  });

  it("sets badge text to '' when unmuted", async () => {
    await updateBadgeAndIcon(1, false);
    expect(mockCalls.action.setBadgeText).toContainEqual({
      tabId: 1,
      text: BADGE_UNMUTED,
    });
  });

  it("sets red color when muted", async () => {
    await updateBadgeAndIcon(1, true);
    expect(mockCalls.action.setBadgeBackgroundColor).toContainEqual({
      color: BADGE_COLOR_MUTED,
      tabId: 1,
    });
  });

  it("sets green color when unmuted", async () => {
    await updateBadgeAndIcon(1, false);
    expect(mockCalls.action.setBadgeBackgroundColor).toContainEqual({
      color: BADGE_COLOR_UNMUTED,
      tabId: 1,
    });
  });

  it("uses muted-light icon paths in light mode when muted", async () => {
    await updateBadgeAndIcon(1, true);
    expect(mockCalls.action.setIcon.length).toBeGreaterThan(0);
    expect(mockCalls.action.setIcon[0]?.path["16"]).toContain("muted-light");
  });

  it("uses unmuted-dark icon paths in dark mode when unmuted", async () => {
    await chrome.storage.session.set({ isDarkMode: true });
    await updateBadgeAndIcon(1, false);
    expect(mockCalls.action.setIcon[0]?.path["16"]).toContain("unmuted-dark");
  });

  it("falls back to base icons when setIcon rejects on first call", async () => {
    mockConfig.action.setIconRejectTimes = 1;
    await updateBadgeAndIcon(1, true);
    expect(mockCalls.action.setIcon).toHaveLength(2);

    expect(mockCalls.action.setIcon[1]?.path["16"]).toBe("icons/icon-16.png");
  });
});

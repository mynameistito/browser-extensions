import { describe, expect, test } from "bun:test";

import {
  BADGE_MUTED,
  BADGE_UNMUTED,
  COMMAND_TOGGLE_MUTE,
  CONTEXT_MENU_MUTE_ALL,
  CONTEXT_MENU_TOGGLE_ID,
  STORAGE_KEY_DARK_MODE,
  STORAGE_KEY_MUTED_TABS,
} from "@/utils/constants.ts";

describe("constants", () => {
  test("STORAGE_KEY_MUTED_TABS", () =>
    expect(STORAGE_KEY_MUTED_TABS).toBe("mutedTabs"));
  test("STORAGE_KEY_DARK_MODE", () =>
    expect(STORAGE_KEY_DARK_MODE).toBe("isDarkMode"));
  test("COMMAND_TOGGLE_MUTE", () =>
    expect(COMMAND_TOGGLE_MUTE).toBe("toggle-mute"));
  test("CONTEXT_MENU_TOGGLE_ID", () =>
    expect(CONTEXT_MENU_TOGGLE_ID).toBe("mute-tab"));
  test("CONTEXT_MENU_MUTE_ALL", () =>
    expect(CONTEXT_MENU_MUTE_ALL).toBe("mute-all-tabs"));
  test("BADGE_MUTED", () => expect(BADGE_MUTED).toBe("M"));
  test("BADGE_UNMUTED", () => expect(BADGE_UNMUTED).toBe(""));
});

import { it, describe, expect } from "vitest";

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
  it("STORAGE_KEY_MUTED_TABS", () => {
    expect(STORAGE_KEY_MUTED_TABS).toBe("mutedTabs");
  });

  it("STORAGE_KEY_DARK_MODE", () => {
    expect(STORAGE_KEY_DARK_MODE).toBe("isDarkMode");
  });

  it("COMMAND_TOGGLE_MUTE", () => {
    expect(COMMAND_TOGGLE_MUTE).toBe("toggle-mute");
  });

  it("CONTEXT_MENU_TOGGLE_ID", () => {
    expect(CONTEXT_MENU_TOGGLE_ID).toBe("mute-tab");
  });

  it("CONTEXT_MENU_MUTE_ALL", () => {
    expect(CONTEXT_MENU_MUTE_ALL).toBe("mute-all-tabs");
  });

  it("BADGE_MUTED", () => {
    expect(BADGE_MUTED).toBe("M");
  });

  it("BADGE_UNMUTED", () => {
    expect(BADGE_UNMUTED).toBe("");
  });
});

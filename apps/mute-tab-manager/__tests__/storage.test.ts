import { it, describe, expect, beforeEach } from "vitest";

import { resetChromeMock } from "@/tests/helpers/chrome-mock.ts";
import {
  getIsDarkMode,
  getMutedTabs,
  isTabMuted,
  removeTabFromStorage,
  setTabMuted,
} from "@/utils/storage.ts";

describe("storage utilities", () => {
  beforeEach(() => {
    resetChromeMock();
  });

  describe(getMutedTabs, () => {
    it("returns {} when storage is empty", async () => {
      await expect(getMutedTabs()).resolves.toStrictEqual({});
    });

    it("returns stored data", async () => {
      await chrome.storage.session.set({ mutedTabs: { 1: true, 2: false } });
      await expect(getMutedTabs()).resolves.toStrictEqual({
        1: true,
        2: false,
      });
    });

    it("returns {} when stored value is null", async () => {
      await chrome.storage.session.set({ mutedTabs: null });
      await expect(getMutedTabs()).resolves.toStrictEqual({});
    });

    it("returns {} when stored value is a non-object primitive", async () => {
      await chrome.storage.session.set({ mutedTabs: 42 });
      await expect(getMutedTabs()).resolves.toStrictEqual({});
    });

    it("returns {} when stored map contains non-boolean values", async () => {
      await chrome.storage.session.set({
        mutedTabs: { 1: true, 2: "muted" },
      });
      await expect(getMutedTabs()).resolves.toStrictEqual({});
    });
  });

  describe(setTabMuted, () => {
    it("writes true for a tab", async () => {
      await setTabMuted(5, true);
      const mutedTabs = await getMutedTabs();
      expect(mutedTabs[5]).toBeTruthy();
    });

    it("writes false for a tab", async () => {
      await setTabMuted(5, false);
      const mutedTabs = await getMutedTabs();
      expect(mutedTabs[5]).toBeFalsy();
    });

    it("preserves other entries", async () => {
      await setTabMuted(1, true);
      await setTabMuted(2, false);
      const result = await getMutedTabs();
      expect(result[1]).toBeTruthy();
      expect(result[2]).toBeFalsy();
    });

    it("overwrites same key", async () => {
      await setTabMuted(1, true);
      await setTabMuted(1, false);
      const mutedTabs = await getMutedTabs();
      expect(mutedTabs[1]).toBeFalsy();
    });
  });

  describe(removeTabFromStorage, () => {
    it("removes target tab", async () => {
      await setTabMuted(1, true);
      await removeTabFromStorage(1);
      const mutedTabs = await getMutedTabs();
      expect(mutedTabs[1]).toBeUndefined();
    });

    it("no-op for missing key", async () => {
      await removeTabFromStorage(99);
      await expect(getMutedTabs()).resolves.toStrictEqual({});
    });

    it("preserves other entries", async () => {
      await setTabMuted(1, true);
      await setTabMuted(2, true);
      await removeTabFromStorage(1);
      const result = await getMutedTabs();
      expect(result[1]).toBeUndefined();
      expect(result[2]).toBeTruthy();
    });
  });

  describe(isTabMuted, () => {
    it("returns true for muted tab", async () => {
      await setTabMuted(1, true);
      await expect(isTabMuted(1)).resolves.toBeTruthy();
    });

    it("returns false for unmuted tab", async () => {
      await setTabMuted(1, false);
      await expect(isTabMuted(1)).resolves.toBeFalsy();
    });

    it("returns false for missing tab", async () => {
      await expect(isTabMuted(99)).resolves.toBeFalsy();
    });
  });

  describe(getIsDarkMode, () => {
    it("returns true when set to true", async () => {
      await chrome.storage.session.set({ isDarkMode: true });
      await expect(getIsDarkMode()).resolves.toBeTruthy();
    });

    it("returns false when set to false", async () => {
      await chrome.storage.session.set({ isDarkMode: false });
      await expect(getIsDarkMode()).resolves.toBeFalsy();
    });

    it("returns false when not set", async () => {
      await expect(getIsDarkMode()).resolves.toBeFalsy();
    });
  });
});

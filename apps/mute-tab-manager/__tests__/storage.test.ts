import { beforeEach, describe, expect, test } from "bun:test";

import { resetChromeMock } from "@/tests/helpers/chrome-mock.ts";
import {
  getIsDarkMode,
  getMutedTabs,
  isTabMuted,
  removeTabFromStorage,
  setTabMuted,
} from "@/utils/storage.ts";

beforeEach(() => {
  resetChromeMock();
});

describe("getMutedTabs", () => {
  test("returns {} when storage is empty", async () => {
    expect(await getMutedTabs()).toEqual({});
  });

  test("returns stored data", async () => {
    await chrome.storage.session.set({ mutedTabs: { 1: true, 2: false } });
    expect(await getMutedTabs()).toEqual({ 1: true, 2: false });
  });

  test("returns {} when stored value is null", async () => {
    await chrome.storage.session.set({ mutedTabs: null });
    expect(await getMutedTabs()).toEqual({});
  });

  test("returns {} when stored value is a non-object primitive", async () => {
    await chrome.storage.session.set({ mutedTabs: 42 });
    expect(await getMutedTabs()).toEqual({});
  });
});

describe("setTabMuted", () => {
  test("writes true for a tab", async () => {
    await setTabMuted(5, true);
    const mutedTabs = await getMutedTabs();
    expect(mutedTabs[5]).toBe(true);
  });

  test("writes false for a tab", async () => {
    await setTabMuted(5, false);
    const mutedTabs = await getMutedTabs();
    expect(mutedTabs[5]).toBe(false);
  });

  test("preserves other entries", async () => {
    await setTabMuted(1, true);
    await setTabMuted(2, false);
    const result = await getMutedTabs();
    expect(result[1]).toBe(true);
    expect(result[2]).toBe(false);
  });

  test("overwrites same key", async () => {
    await setTabMuted(1, true);
    await setTabMuted(1, false);
    const mutedTabs = await getMutedTabs();
    expect(mutedTabs[1]).toBe(false);
  });
});

describe("removeTabFromStorage", () => {
  test("removes target tab", async () => {
    await setTabMuted(1, true);
    await removeTabFromStorage(1);
    const mutedTabs = await getMutedTabs();
    expect(mutedTabs[1]).toBeUndefined();
  });

  test("no-op for missing key", async () => {
    await removeTabFromStorage(99);
    expect(await getMutedTabs()).toEqual({});
  });

  test("preserves other entries", async () => {
    await setTabMuted(1, true);
    await setTabMuted(2, true);
    await removeTabFromStorage(1);
    const result = await getMutedTabs();
    expect(result[1]).toBeUndefined();
    expect(result[2]).toBe(true);
  });
});

describe("isTabMuted", () => {
  test("returns true for muted tab", async () => {
    await setTabMuted(1, true);
    expect(await isTabMuted(1)).toBe(true);
  });

  test("returns false for unmuted tab", async () => {
    await setTabMuted(1, false);
    expect(await isTabMuted(1)).toBe(false);
  });

  test("returns false for missing tab", async () => {
    expect(await isTabMuted(99)).toBe(false);
  });
});

describe("getIsDarkMode", () => {
  test("returns true when set to true", async () => {
    await chrome.storage.session.set({ isDarkMode: true });
    expect(await getIsDarkMode()).toBe(true);
  });

  test("returns false when set to false", async () => {
    await chrome.storage.session.set({ isDarkMode: false });
    expect(await getIsDarkMode()).toBe(false);
  });

  test("returns false when not set", async () => {
    expect(await getIsDarkMode()).toBe(false);
  });
});

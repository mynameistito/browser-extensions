import { beforeAll, beforeEach, describe, expect, test } from "bun:test";

import {
  listenerDelta,
  mockEvents,
  resetChromeMock,
  restoreListeners,
  snapshotListeners,
} from "@/tests/helpers/chrome-mock.ts";

let myListeners: ReturnType<typeof snapshotListeners>;

beforeAll(async () => {
  const before = snapshotListeners();
  // Importing the entrypoint with our defineContentScript stub immediately
  // invokes main() and registers DOM/runtime listeners.
  const mod = await import("@/entrypoints/youtube.content.ts");
  // The default export is the object returned by defineContentScript;
  // invoke its main() to install runtime listeners (idempotent).
  // WXT passes a ContentScriptContext at runtime — pass a stub for tests.
  mod.default.main({} as never);
  myListeners = listenerDelta(before, snapshotListeners());
});

beforeEach(async () => {
  resetChromeMock();
  restoreListeners(myListeners);
  document.body.innerHTML = "";
  // Reset module-level isMuted via a SET_MUTED:false message
  await mockEvents.runtime.onMessage.fire(
    { muted: false, type: "SET_MUTED" },
    {} as chrome.runtime.MessageSender,
    () => {}
  );
});

describe("SET_MUTED message", () => {
  test("mutes all video elements when muted=true", async () => {
    const video = document.createElement("video");
    document.body.append(video);

    await mockEvents.runtime.onMessage.fire(
      { muted: true, type: "SET_MUTED" },
      {} as chrome.runtime.MessageSender,
      () => {}
    );

    expect(video.muted).toBe(true);
  });

  test("unmutes all video elements when muted=false", async () => {
    const video = document.createElement("video");
    video.muted = true;
    document.body.append(video);

    await mockEvents.runtime.onMessage.fire(
      { muted: false, type: "SET_MUTED" },
      {} as chrome.runtime.MessageSender,
      () => {}
    );

    expect(video.muted).toBe(false);
  });

  test("no error when no videos present", async () => {
    await expect(
      mockEvents.runtime.onMessage.fire(
        { muted: true, type: "SET_MUTED" },
        {} as chrome.runtime.MessageSender,
        () => {}
      )
    ).resolves.toBeUndefined();
  });
});

describe("yt-navigate-finish event", () => {
  test("mutes existing videos while muted", async () => {
    const video = document.createElement("video");
    document.body.append(video);

    await mockEvents.runtime.onMessage.fire(
      { muted: true, type: "SET_MUTED" },
      {} as chrome.runtime.MessageSender,
      () => {}
    );

    video.muted = false;
    document.dispatchEvent(new Event("yt-navigate-finish"));
    expect(video.muted).toBe(true);
  });

  test("does not mute videos while not muted", () => {
    const video = document.createElement("video");
    document.body.append(video);
    document.dispatchEvent(new Event("yt-navigate-finish"));
    expect(video.muted).toBe(false);
  });
});

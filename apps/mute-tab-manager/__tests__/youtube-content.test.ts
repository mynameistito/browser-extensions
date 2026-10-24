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
  mod.installYoutubeContentHandlers();
  myListeners = listenerDelta(before, snapshotListeners());
});

beforeEach(async () => {
  resetChromeMock();
  restoreListeners(myListeners);
  document.body.replaceChildren();
  // Reset module-level isMuted via a SET_MUTED:false message
  await mockEvents.runtime.onMessage.fire(
    { muted: false, type: "SET_MUTED" },
    {},
    () => {}
  );
});

describe("SET_MUTED message", () => {
  test("mutes all video elements when muted=true", async () => {
    const video = document.createElement("video");
    document.body.append(video);

    await mockEvents.runtime.onMessage.fire(
      { muted: true, type: "SET_MUTED" },
      {},
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
      {},
      () => {}
    );

    expect(video.muted).toBe(false);
  });

  test("no error when no videos present", async () => {
    await mockEvents.runtime.onMessage.fire(
      { muted: true, type: "SET_MUTED" },
      {},
      () => {}
    );
  });
});

describe("yt-navigate-finish event", () => {
  test("mutes existing videos while muted", async () => {
    const video = document.createElement("video");
    document.body.append(video);

    await mockEvents.runtime.onMessage.fire(
      { muted: true, type: "SET_MUTED" },
      {},
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

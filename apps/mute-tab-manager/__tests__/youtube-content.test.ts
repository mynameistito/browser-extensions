import { expect, it, describe, beforeAll, beforeEach } from "vitest";

import {
  listenerDelta,
  mockEvents,
  resetChromeMock,
  restoreListeners,
  snapshotListeners,
} from "@/tests/helpers/chrome-mock.ts";

let myListeners: ReturnType<typeof snapshotListeners>;

describe("YouTube content handlers", () => {
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
    it("mutes all video elements when muted=true", async () => {
      const video = document.createElement("video");
      document.body.append(video);

      await mockEvents.runtime.onMessage.fire(
        { muted: true, type: "SET_MUTED" },
        {},
        () => {}
      );

      expect(video.muted).toBeTruthy();
    });

    it("unmutes all video elements when muted=false", async () => {
      const video = document.createElement("video");
      video.muted = true;
      document.body.append(video);

      await mockEvents.runtime.onMessage.fire(
        { muted: false, type: "SET_MUTED" },
        {},
        () => {}
      );

      expect(video.muted).toBeFalsy();
    });

    it("no error when no videos present", async () => {
      await expect(
        mockEvents.runtime.onMessage.fire(
          { muted: true, type: "SET_MUTED" },
          {},
          () => {}
        )
      ).resolves.toBeUndefined();
    });
  });

  describe("yt-navigate-finish event", () => {
    it("mutes existing videos while muted", async () => {
      const video = document.createElement("video");
      document.body.append(video);

      await mockEvents.runtime.onMessage.fire(
        { muted: true, type: "SET_MUTED" },
        {},
        () => {}
      );

      video.muted = false;
      document.dispatchEvent(new Event("yt-navigate-finish"));
      expect(video.muted).toBeTruthy();
    });

    it("does not mute videos while not muted", () => {
      const video = document.createElement("video");
      document.body.append(video);
      document.dispatchEvent(new Event("yt-navigate-finish"));
      expect(video.muted).toBeFalsy();
    });
  });
});

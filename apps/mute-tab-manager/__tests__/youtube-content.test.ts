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

    it("ignores messages for other handlers", async () => {
      await mockEvents.runtime.onMessage.fire(
        { type: "UNRELATED" },
        {},
        () => {}
      );
      expect(document.body.querySelectorAll("video")).toHaveLength(0);
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

  describe("dynamically inserted media", () => {
    it("mutes a newly inserted video while the tab is muted", async () => {
      await mockEvents.runtime.onMessage.fire(
        { muted: true, type: "SET_MUTED" },
        {},
        () => {}
      );
      const video = document.createElement("video");
      document.body.append(video);
      await Promise.resolve();

      expect(video.muted).toBeTruthy();
    });

    it("mutes videos nested in a newly inserted element", async () => {
      await mockEvents.runtime.onMessage.fire(
        { muted: true, type: "SET_MUTED" },
        {},
        () => {}
      );
      const container = document.createElement("div");
      const video = document.createElement("video");
      container.append(video);
      document.body.append(container);
      await Promise.resolve();

      expect(video.muted).toBeTruthy();
    });

    it("ignores inserted elements without video descendants", async () => {
      await mockEvents.runtime.onMessage.fire(
        { muted: true, type: "SET_MUTED" },
        {},
        () => {}
      );
      document.body.append(document.createElement("div"));
      await Promise.resolve();

      const video = document.createElement("video");
      video.muted = false;
      document.body.append(video);
      await Promise.resolve();

      expect(video.muted).toBeTruthy();
    });
  });
});

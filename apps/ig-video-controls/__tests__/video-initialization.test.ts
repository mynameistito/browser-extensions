import { describe, expect, it, vi } from "vitest";

import {
  hideAllIgVolumeControls,
  incapacitateStoryVideoPausingOverlays,
  modifyOverlayWithInstagramPlayControl,
  modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls,
} from "@/entrypoints/content/overlay-fixes";
import {
  getKnownVideoElements,
  modifyAllPresentVideos,
  modifyVideo,
  redefineWebkitMediaControlHidingCssRule,
  setPlaybackRateIfChanged,
  setSettings,
  setVolumeIfChanged,
} from "@/entrypoints/content/video-controls";

import {
  setupTestEnvironment,
  makeVideo,
  rect,
  requireElement,
  requireHtmlElement,
  setMarkup,
  setRect,
  settings,
} from "./test-helpers";

describe("ig-video-controls", () => {
  const { storageSet } = setupTestEnvironment();

  describe("video control initialization and overlays", () => {
    it("sets persisted values once, prunes removed videos, and defines native CSS once", () => {
      const outer = document.createElement("div");
      outer.className = "EmbedVideo";
      document.body.append(outer);
      const video = makeVideo(outer);
      setSettings({ ...settings(), playbackRate: 1.5, volumeLevel: 0.4 });
      modifyVideo(video);

      const initializedState = [
        video.dataset.igvcInit,
        video.controls,
        video.getAttribute("controlslist"),
        video.volume,
        video.playbackRate,
      ];

      modifyVideo(video);
      const trackedAfterRepeat = getKnownVideoElements().has(video);
      redefineWebkitMediaControlHidingCssRule();
      redefineWebkitMediaControlHidingCssRule();

      const cssRuleCount = document.querySelectorAll(
        "#igvc-native-controls"
      ).length;

      setVolumeIfChanged(video, Number.NaN);
      setVolumeIfChanged(video, 0.4);
      setPlaybackRateIfChanged(video, Number.NaN);
      setPlaybackRateIfChanged(video, 1.5);
      modifyAllPresentVideos();
      video.remove();
      modifyAllPresentVideos();
      expect([
        ...initializedState,
        trackedAfterRepeat,
        cssRuleCount,
        getKnownVideoElements().has(video),
      ]).toStrictEqual(["1", true, "", 0.4, 1.5, true, 1, false]);
    });

    it("skips already initialized siblings while initializing the remaining player", () => {
      const root = document.createElement("div");
      root.className = "EmbedVideo";
      document.body.append(root);
      const initialized = makeVideo(root);
      initialized.dataset.igvcInit = "1";
      const pending = makeVideo(root);
      setSettings(settings());
      modifyVideo(pending);
      expect(initialized.controls).toBeFalsy();
      expect(pending.controls).toBeTruthy();
    });

    it("moves and hides overlay controls and handles story blockers and Instagram volume", () => {
      const root = document.createElement("div");
      document.body.append(root);
      const video = makeVideo(root);
      root.insertAdjacentHTML(
        "beforeend",
        '<div class="videoSpritePlayButton"></div><div><button role="button" aria-label="Play"></button></div><div><button role="button" aria-label="Control"></button></div><div data-instancekey="x"><div><button aria-label="Adjust volume"></button></div></div>'
      );
      const play = requireElement(root.querySelector('[aria-label="Play"]'));

      const sprite = requireElement(
        root.querySelector(".videoSpritePlayButton")
      );

      modifyOverlayWithInstagramPlayControl(root, video);
      expect(requireHtmlElement(sprite.parentElement).style.visibility).toBe(
        "hidden"
      );
      expect(requireHtmlElement(play.parentElement).style.bottom).toBe("70px");
      hideAllIgVolumeControls();
      const sibling = document.createElement("div");
      video.before(sibling);
      incapacitateStoryVideoPausingOverlays(video);
      expect(requireHtmlElement(sibling).style.visibility).toBe("hidden");
      modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
        video
      );
    });

    it("remembers user volume and playback changes across initialized videos", async () => {
      vi.useFakeTimers();
      const root = document.createElement("div");
      root.className = "EmbedVideo";
      document.body.append(root);
      const first = makeVideo(root);
      const second = makeVideo(root);
      const initial = settings();
      setSettings(initial);
      modifyVideo(first);
      modifyVideo(second);
      vi.advanceTimersByTime(2000);

      first.volume = 0.6;
      first.dispatchEvent(new Event("volumechange"));
      first.playbackRate = 1.75;
      first.dispatchEvent(new Event("ratechange"));
      vi.advanceTimersByTime(200);
      await Promise.resolve();

      expect([
        initial.volumeLevel,
        initial.playbackRate,
        second.volume,
        second.playbackRate,
        ...storageSet.mock.calls,
      ]).toStrictEqual([
        0.6,
        1.75,
        0.6,
        1.75,
        [{ volumeLevel: 0.6 }],
        [{ playbackRate: 1.75 }],
      ]);
    });

    it("synchronizes mute state only when Instagram exposes a known audio icon", () => {
      vi.useFakeTimers();
      const root = document.createElement("div");
      root.className = "EmbedVideo";
      const video = makeVideo(root);
      const instance = document.createElement("div");
      instance.dataset.instancekey = "sync";
      setMarkup(
        instance,
        '<div role="button"><svg aria-label="Audio muted"></svg></div>'
      );
      document.body.append(root, instance);
      const mute = requireElement(instance.querySelector("[role=button]"));
      const clicked = vi.fn<() => void>(() => {});
      mute.addEventListener("click", clicked);
      setSettings(settings());
      modifyVideo(video);
      vi.advanceTimersByTime(2000);

      video.dispatchEvent(new Event("volumechange"));
      vi.advanceTimersByTime(200);
      expect(clicked).toHaveBeenCalledOnce();

      video.muted = true;
      video.dispatchEvent(new Event("volumechange"));
      vi.advanceTimersByTime(200);
      expect(clicked).toHaveBeenCalledOnce();

      setMarkup(
        instance,
        '<div role="button"><svg aria-label="Audio"></svg></div>'
      );

      const unmutedIcon = requireElement(
        instance.querySelector("[role=button]")
      );

      const unmutedClick = vi.fn<() => void>(() => {});
      unmutedIcon.addEventListener("click", unmutedClick);
      video.dispatchEvent(new Event("volumechange"));
      vi.advanceTimersByTime(200);
      expect(unmutedClick).toHaveBeenCalledOnce();

      setMarkup(instance, '<div role="button"><svg></svg></div>');
      video.dispatchEvent(new Event("volumechange"));
      vi.advanceTimersByTime(200);
      expect(unmutedClick).toHaveBeenCalledOnce();
    });

    it("does not remember changes when preferences are disabled or during initialization", () => {
      vi.useFakeTimers();
      const root = document.createElement("div");
      root.className = "EmbedVideo";
      document.body.append(root);
      const video = makeVideo(root);

      const initial = {
        ...settings(),
        rememberPlaybackRate: false,
        rememberVolumeLevel: false,
      };

      setSettings(initial);
      modifyVideo(video);
      video.volume = 0.5;
      video.playbackRate = 2;
      video.dispatchEvent(new Event("volumechange"));
      video.dispatchEvent(new Event("ratechange"));
      vi.advanceTimersByTime(200);

      expect(storageSet).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      video.dispatchEvent(new Event("volumechange"));
      video.dispatchEvent(new Event("ratechange"));
      vi.advanceTimersByTime(200);
      modifyAllPresentVideos();
      expect(initial.volumeLevel).toBe(1);
      expect(initial.playbackRate).toBe(1);
    });

    it("handles missing roots, invalid media values, and detached story nodes", () => {
      const standaloneVideo = document.createElement("video");
      modifyVideo(standaloneVideo);
      expect(standaloneVideo.dataset.igvcInit).toBeUndefined();

      const video = makeVideo();
      Object.defineProperty(video, "volume", {
        configurable: true,
        get: () => 1,
        set: () => {
          throw new Error("volume is locked");
        },
      });
      Object.defineProperty(video, "playbackRate", {
        configurable: true,
        get: () => 1,
        set: () => {
          throw new Error("rate is locked");
        },
      });
      expect(() => {
        setVolumeIfChanged(video, 0.5);
      }).not.toThrow();
      expect(() => {
        setPlaybackRateIfChanged(video, 2);
      }).not.toThrow();
      incapacitateStoryVideoPausingOverlays(document.createElement("video"));
    });

    it("initializes story controls and runs delayed layout repairs", () => {
      vi.useFakeTimers();
      history.replaceState(null, "", "/stories/person/1");
      const root = document.createElement("div");
      root.className = "EmbedVideo";
      setMarkup(
        root,
        '<button></button><div class="overlay"></div><header></header><video></video><div class="send"><textarea placeholder="Message"></textarea></div>'
      );
      document.body.append(root);
      const video = requireElement(root.querySelector("video"));
      const overlay = requireHtmlElement(root.querySelector(".overlay"));
      const textarea = requireElement(root.querySelector("textarea"));
      setRect(video, rect(300, 600));
      setRect(root, rect(300, 600));
      setRect(textarea, rect(280, 40, 500));
      setRect(requireElement(root.querySelector(".send")), rect(280, 40, 500));
      setSettings(settings());

      modifyVideo(video);
      expect(video.dataset.igvcInit).toBe("1");
      expect(overlay.style.visibility).toBe("hidden");
      vi.advanceTimersByTime(1500);
      expect(video.style.height).toContain("calc(100% -");
    });
  });
});

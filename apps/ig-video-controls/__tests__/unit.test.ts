import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initializeSettings } from "@/entrypoints/background";
import { initializeContentScript } from "@/entrypoints/content";
import {
  isInstagramHomePage,
  isInstagramPostPage,
  isInstagramReelsPage,
  isInstagramStoriesPage,
  isIgMuted,
  nParents,
  nthParent,
  getVideoCoveringButtons,
  getEstimatedVideoComponentRootElement,
  getComponentRootForStoryVideo,
  findVolumeOrTagsButtons,
  findIgMuteButton,
  isIgMuted as getIgMuteState,
} from "@/entrypoints/content/button-finder";
import {
  cmpToPrecision,
  debounce,
  fromHtml,
  getAllChildrenOfParent,
  hide,
  query,
  queryAll,
  throttle,
} from "@/entrypoints/content/dom";
import {
  hideAllIgVolumeControls,
  incapacitateStoryVideoPausingOverlays,
  modifyOverlayWithInstagramPlayControl,
  modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls,
} from "@/entrypoints/content/overlay-fixes";
import {
  loadSettings,
  persistSettings,
  saveSettings,
  subscribeToSettings,
} from "@/entrypoints/content/settings";
import {
  getKnownVideoElements,
  modifyAllPresentVideos,
  modifyVideo,
  redefineWebkitMediaControlHidingCssRule,
  setPlaybackRateIfChanged,
  setSettings,
  setVolumeIfChanged,
} from "@/entrypoints/content/video-controls";
import { showSpeedOsd, showVolumeOsd } from "@/entrypoints/content/video-osd";
import {
  initWheelHotkeys,
  updateWheelSettings,
} from "@/entrypoints/content/wheel-hotkeys";
import { DEFAULTS } from "@/lib/defaults";
import {
  clamp,
  dimensionWithinXPercentOrAbsoluteValue,
  snapToStep,
  valuesAreDifferentEnough,
} from "@/lib/math";

const requireHtmlElement = (element: Element | null): HTMLElement => {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError("Expected an HTML element in the test fixture");
  }

  return element;
};

const requireElement = <T extends Element>(element: T | null): T => {
  if (!element) {
    throw new TypeError("Expected an element in the test fixture");
  }

  return element;
};

const settings = (): typeof DEFAULTS => ({ ...DEFAULTS });

const rect = (width: number, height: number, top = 0, left = 0): DOMRect =>
  new DOMRect(left, top, width, height);

const setRect = (el: Element, value: DOMRect) =>
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue(value);

const setMarkup = (target: Element, markup: string): void => {
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  target.replaceChildren(...parsed.body.childNodes);
};

const makeVideo = (parent: Element = document.body): HTMLVideoElement => {
  const video = document.createElement("video");
  parent.append(video);
  setRect(video, rect(300, 600));

  return video;
};

describe("ig-video-controls", () => {
  const storageGet = vi.fn<
    (values: typeof DEFAULTS) => Promise<Partial<typeof DEFAULTS>>
  >(async (values) => await Promise.resolve(values));

  const storageSet = vi.fn<(values: Partial<typeof DEFAULTS>) => Promise<void>>(
    async () => {}
  );

  const addStorageListener = vi.fn<
    (
      listener: (
        changes: Record<string, Browser.storage.StorageChange>,
        areaName?: string
      ) => void
    ) => void
  >(() => {});

  const removeStorageListener = vi.fn<() => void>(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    setMarkup(document.body, "");
    history.replaceState(null, "", "/");
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: storageGet,
          set: storageSet,
        },
        onChanged: {
          addListener: addStorageListener,
          removeListener: removeStorageListener,
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("shared math and defaults", () => {
    it("clamps, snaps valid steps, and leaves invalid steps untouched", () => {
      expect(DEFAULTS).toStrictEqual({
        playbackRate: 1,
        playbackRateAdjustmentStepSize: 0.25,
        rememberPlaybackRate: true,
        rememberVolumeLevel: true,
        volumeAdjustmentStepSize: 0.1,
        volumeLevel: 1,
      });
      expect([
        clamp(-1, 0, 1),
        clamp(2, 0, 1),
        snapToStep(1.13, 0.25),
        snapToStep(1.13, 0),
        snapToStep(1.13, Number.NaN),
      ]).toStrictEqual([0, 1, 1.25, 1.13, 1.13]);
      expect([
        valuesAreDifferentEnough(1, 1.01),
        valuesAreDifferentEnough(1, 1.001),
        dimensionWithinXPercentOrAbsoluteValue(0, 100, 1.1, 100),
        dimensionWithinXPercentOrAbsoluteValue(100, 110, 1.1, 0),
        dimensionWithinXPercentOrAbsoluteValue(100, 121, 1.2, 0),
        dimensionWithinXPercentOrAbsoluteValue(Number.NaN, 1, 2, 1),
        dimensionWithinXPercentOrAbsoluteValue(-1, -2, 2, 0),
      ]).toStrictEqual([true, false, true, true, false, false, false]);
    });
  });

  describe("DOM helpers", () => {
    it("queries, parses fragments, hides elements, compares precision, and lists siblings", () => {
      setMarkup(
        document.body,
        "<main><i></i><b id='target'></b><u></u></main>"
      );
      const target = requireElement(document.querySelector("#target"));
      expect([
        query("#target"),
        query("missing"),
        queryAll("i, b").length,
        queryAll("i", null).length,
        fromHtml("<em>ok</em>")?.tagName,
        fromHtml("text only"),
        cmpToPrecision(1.239, 1.231, 2),
        getAllChildrenOfParent(target).length,
        getAllChildrenOfParent(document.createElement("i")),
      ]).toStrictEqual([target, null, 2, 1, "EM", null, 0, 3, []]);
      hide(target);
      hide(null);
      expect(requireHtmlElement(target).style.visibility).toBe("hidden");
    });

    it("debounces latest arguments and throttles leading/trailing calls", () => {
      vi.useFakeTimers();
      const call = vi.fn<(...args: unknown[]) => void>();
      const delayed = debounce(call, 20);
      delayed("first");
      delayed("last");
      vi.advanceTimersByTime(20);
      const throttled = throttle(call, 50);
      throttled("a");
      throttled("b");
      vi.advanceTimersByTime(50);
      const noLeading = throttle(call, 25, { leading: false, trailing: false });
      noLeading("ignored");
      vi.advanceTimersByTime(30);

      const leadingOnly = throttle(call, 10, {
        leading: true,
        trailing: false,
      });

      leadingOnly("immediate");
      leadingOnly("suppressed");
      const trailing = throttle(call, 20, { leading: false });
      trailing("deferred");
      vi.advanceTimersByTime(20);
      vi.setSystemTime(1);
      const replacedTrailing = throttle(call, 50, { leading: false });
      replacedTrailing("replaced");
      vi.setSystemTime(51);
      replacedTrailing("immediate");
      expect(call.mock.calls).toStrictEqual([
        ["last"],
        ["a"],
        ["b"],
        ["immediate"],
        ["deferred"],
        ["immediate"],
      ]);
    });
  });

  describe("Instagram DOM discovery", () => {
    it("recognizes routes and walks bounded ancestors", () => {
      const routeResults = [isInstagramHomePage()];
      history.replaceState(null, "", "/feed/");
      routeResults.push(isInstagramHomePage());
      history.replaceState(null, "", "/Reels/id");
      routeResults.push(isInstagramReelsPage());
      history.replaceState(null, "", "/STORIES/name/1");
      routeResults.push(isInstagramStoriesPage());
      history.replaceState(null, "", "/P/id");
      routeResults.push(isInstagramPostPage());
      const parent = document.createElement("div");
      setMarkup(parent, "<span></span>");
      const child = requireElement(parent.firstElementChild);

      const ancestorResults = [
        nthParent(child, 1),
        nthParent(child, 3),
        nthParent(null, 0),
        nParents(child, 3),
        nParents(null, 2),
      ];

      const plainContainer = document.createElement("div");
      const plainVideo = document.createElement("video");
      plainContainer.append(plainVideo);
      expect(getEstimatedVideoComponentRootElement(plainVideo)).toBeUndefined();
      history.replaceState(null, "", "/other");
      routeResults.push(
        isInstagramHomePage(),
        isInstagramReelsPage(),
        isInstagramStoriesPage(),
        isInstagramPostPage()
      );
      expect(routeResults).toStrictEqual([
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        false,
      ]);
      expect(ancestorResults).toStrictEqual([parent, null, null, [parent], []]);
    });

    it("finds video overlays, story roots, audio/tags controls, and mute state", () => {
      const root = document.createElement("div");
      setMarkup(
        root,
        '<div><div><video></video><div role="button"></div></div></div>'
      );
      document.body.append(root);
      const video = requireElement(root.querySelector("video"));
      const overlay = requireElement(root.querySelector('[role="button"]'));
      setRect(video, rect(300, 600));
      setRect(overlay, rect(300, 600));
      const estimatedRoot = getEstimatedVideoComponentRootElement(video);
      expect([
        getVideoCoveringButtons(root, video),
        estimatedRoot !== undefined,
        getEstimatedVideoComponentRootElement(document.createElement("video")),
      ]).toStrictEqual([[overlay], true, undefined]);
      const story = document.createElement("div");
      setMarkup(
        story,
        "<button></button><div></div><header></header><video></video>"
      );
      document.body.append(story);
      const storyVideo = requireElement(story.querySelector("video"));
      expect(getComponentRootForStoryVideo(storyVideo)).toBe(story);
      const audioAndTags = document.createElement("div");
      setMarkup(
        audioAndTags,
        '<button aria-label="Audio"><svg></svg></button><button><svg aria-label="Tags"></svg></button>'
      );
      root.append(...audioAndTags.childNodes);
      const smallBtns = root.querySelectorAll("button");

      for (const button of smallBtns) {
        setRect(button, rect(20, 20, 500));
      }

      const matches = findVolumeOrTagsButtons(root, video);
      expect([matches.audioButton, matches.tagsButton]).toStrictEqual([
        smallBtns[0],
        smallBtns[1],
      ]);
      history.replaceState(null, "", "/stories/a/1");
      expect(findVolumeOrTagsButtons(root, video).buttons).toHaveLength(2);
      const videoContainer = document.createElement("div");
      const instance = document.createElement("div");
      instance.dataset.instancekey = "x";
      setMarkup(
        instance,
        '<svg aria-label="Like"></svg><div role="button"><svg aria-label="Audio muted"></svg></div>'
      );
      videoContainer.append(video);
      root.replaceChildren(videoContainer, instance);

      const muteButton = requireElement(
        instance.querySelector("[role=button]")
      );

      const muteResults: unknown[] = [
        findIgMuteButton(video),
        isIgMuted(muteButton),
      ];

      setMarkup(instance, '<svg viewBox="0 0 48 48"></svg>');
      muteResults.push(isIgMuted(instance));
      setMarkup(instance, "<svg></svg>");
      muteResults.push(
        isIgMuted(instance),
        findIgMuteButton(document.createElement("video")),
        getIgMuteState(document.createElement("button"))
      );
      const unknownIcon = document.createElement("button");
      setMarkup(unknownIcon, '<svg viewBox=""></svg>');
      muteResults.push(getIgMuteState(unknownIcon));
      setMarkup(unknownIcon, '<svg aria-label="Audio"></svg>');
      muteResults.push(getIgMuteState(unknownIcon));
      const section = document.createElement("section");
      const sectionVideo = document.createElement("video");
      section.append(sectionVideo);
      muteResults.push(findIgMuteButton(sectionVideo));
      expect(muteResults).toStrictEqual([
        muteButton,
        true,
        true,
        undefined,
        null,
        undefined,
        undefined,
        false,
        null,
      ]);
    });

    it("discovers story-header buttons and recognizes SVG path-only controls", () => {
      history.replaceState(null, "", "/stories/person/1");
      const section = document.createElement("section");
      setMarkup(
        section,
        '<header><button><svg><path d="M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0"></path></svg></button><button><svg><path d="M21.334 23H2.666a1 0 0 1-1-1v-1.354a6.279"></path></svg></button></header><div class="content"></div>'
      );
      document.body.append(section);
      const root = requireElement(section.querySelector(".content"));
      const video = document.createElement("video");
      root.append(video);
      const buttons = [...section.querySelectorAll("button")];
      const audio = requireElement(buttons[0] ?? null);
      const tags = requireElement(buttons[1] ?? null);
      setRect(audio, rect(20, 20));
      setRect(tags, rect(61, 61));
      const found = findVolumeOrTagsButtons(root, video);
      expect([
        found.buttons,
        found.audioButton,
        found.tagsButton,
      ]).toStrictEqual([[audio], audio, undefined]);

      history.replaceState(null, "", "/feed/");
      const nonStory = document.createElement("div");
      setMarkup(
        nonStory,
        '<button><svg><path d="M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0"></path></svg></button><button><svg aria-label="Tags"></svg></button>'
      );
      document.body.append(nonStory);
      const controls = [...nonStory.querySelectorAll("button")];

      for (const button of controls) {
        setRect(button, rect(20, 20, 10));
      }

      setRect(video, rect(300, 600));
      const matches = findVolumeOrTagsButtons(nonStory, video);
      history.replaceState(null, "", "/stories/elsewhere/1");

      const emptyMatches = [
        findVolumeOrTagsButtons(document.createElement("div"), video).buttons,
      ];

      const sectionWithoutHeader = document.createElement("section");
      emptyMatches.push(
        findVolumeOrTagsButtons(sectionWithoutHeader, video).buttons
      );
      expect([
        matches.audioButton,
        matches.tagsButton,
        ...emptyMatches,
      ]).toStrictEqual([undefined, undefined, [], []]);
    });
  });

  describe("settings storage", () => {
    it("loads, saves, persists best-effort, and notifies only for relevant changes", async () => {
      await expect(loadSettings()).resolves.toStrictEqual(DEFAULTS);
      await saveSettings({ volumeLevel: 0.4 });
      expect(storageSet).toHaveBeenCalledWith({
        volumeLevel: 0.4,
      });
      persistSettings({ volumeLevel: 0.3 });
      await Promise.resolve();
      const handler = vi.fn<(settings: typeof DEFAULTS) => void>();
      const unsubscribe = subscribeToSettings(handler);
      expect(addStorageListener).toHaveBeenCalledOnce();

      const listener = addStorageListener.mock.calls[0]?.[0];

      if (!listener) {
        throw new TypeError("Expected the storage change listener");
      }

      listener({ unrelated: {} }, "local");
      await Promise.resolve();
      expect(handler).not.toHaveBeenCalled();
      listener({ volumeLevel: {} }, "local");
      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith(DEFAULTS);
      });
      unsubscribe();
      expect(removeStorageListener).toHaveBeenCalledOnce();
    });

    it("ignores storage read and write failures", async () => {
      storageGet.mockRejectedValueOnce(new Error("unavailable"));
      await expect(loadSettings()).rejects.toThrow("unavailable");
      storageSet.mockRejectedValueOnce(new Error("closed"));
      persistSettings({ volumeLevel: 0.2 });
      await Promise.resolve();
      await Promise.resolve();

      const unsubscribe = subscribeToSettings(
        vi.fn<(settings: typeof DEFAULTS) => void>()
      );

      storageGet.mockRejectedValueOnce(new Error("closed"));

      const listener = addStorageListener.mock.calls.at(-1)?.[0];

      if (!listener) {
        throw new TypeError("Expected the storage change listener");
      }

      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      listener({ playbackRate: {} }, "local");
      await Promise.resolve();
      await Promise.resolve();
      expect(error).toHaveBeenCalledOnce();
      unsubscribe();
    });

    it("supports multiple subscribers without duplicating the storage listener", () => {
      const first = vi.fn<(settings: typeof DEFAULTS) => void>();
      const second = vi.fn<(settings: typeof DEFAULTS) => void>();
      const unsubscribeFirst = subscribeToSettings(first);
      const unsubscribeSecond = subscribeToSettings(second);

      expect(addStorageListener).toHaveBeenCalledOnce();
      unsubscribeFirst();
      expect(removeStorageListener).not.toHaveBeenCalled();
      unsubscribeSecond();
      expect(removeStorageListener).toHaveBeenCalledOnce();
    });
  });

  describe("video OSD and wheel controls", () => {
    it("reuses, repositions, refreshes and hides the OSD", () => {
      vi.useFakeTimers();
      const video = makeVideo();
      showVolumeOsd(video, 0.456);
      const osd = requireHtmlElement(document.querySelector(".igvc-osd"));
      const observed: (string | null)[] = [osd.textContent, osd.style.opacity];
      showSpeedOsd(video, 1.5);
      observed.push(
        String(document.querySelectorAll(".igvc-osd").length),
        osd.textContent
      );
      vi.advanceTimersByTime(500);
      observed.push(osd.style.opacity);
      osd.remove();
      showVolumeOsd(video, 0);
      observed.push(String(document.querySelectorAll(".igvc-osd").length));
      document.querySelector(".igvc-osd-value")?.remove();
      showVolumeOsd(video, 0.25);
      observed.push(document.querySelector(".igvc-osd")?.textContent ?? null);
      expect(observed).toStrictEqual(["46%", "1", "1", "1.50x", "0", "1", ""]);
    });

    it("adjusts rate and right-button volume, clamps values, and cleans listeners", () => {
      const video = makeVideo();
      video.dataset.igvcInit = "1";
      const nestedRoot = document.createElement("div");
      const nestedVideo = makeVideo(nestedRoot);
      nestedVideo.dataset.igvcInit = "1";
      const nestedTarget = document.createElement("span");
      nestedRoot.append(nestedTarget);
      document.body.append(nestedRoot);
      nestedTarget.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: -1 })
      );
      const initial = settings();
      setSettings(initial);
      const cleanup = initWheelHotkeys(initial);
      document.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
      video.volume = 1;
      video.muted = true;
      video.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: -1 })
      );
      const observed: unknown[] = [video.volume, video.muted];
      video.volume = 0.5;
      video.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: 1 })
      );
      observed.push(Number(video.volume.toFixed(1)));
      document.dispatchEvent(
        new MouseEvent("contextmenu", { cancelable: true })
      );
      document.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
      video.playbackRate = 1;

      const speedWheel = new WheelEvent("wheel", {
        bubbles: true,
        deltaY: -1,
      });

      Object.defineProperty(speedWheel, "ctrlKey", { value: true });
      video.dispatchEvent(speedWheel);
      observed.push(storageSet.mock.calls.at(-1)?.[0], video.playbackRate);
      updateWheelSettings({ ...initial, playbackRateAdjustmentStepSize: 0.5 });
      cleanup();
      video.playbackRate = 1;
      video.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, ctrlKey: true, deltaY: -1 })
      );
      observed.push(video.playbackRate);
      expect(observed).toStrictEqual([
        1,
        false,
        0.9,
        { playbackRate: 1.25 },
        1.25,
        1,
      ]);
    });

    it("ignores wheel targets without initialized videos and cancels used context menus", () => {
      const video = makeVideo();
      video.dataset.igvcInit = "1";
      video.remove();
      const initial = settings();
      const cleanup = initWheelHotkeys(initial);

      document.dispatchEvent(new WheelEvent("wheel", { deltaY: 1 }));
      const unusualTarget = document.createElement("div");
      Object.defineProperty(unusualTarget, "matches", { value: () => true });
      document.body.append(unusualTarget);
      unusualTarget.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: 1 })
      );
      const falseVideoMatch = document.createElement("section");
      Object.defineProperty(falseVideoMatch, "querySelector", {
        value: () => document.createElement("div"),
      });
      document.body.append(falseVideoMatch);
      falseVideoMatch.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: 1 })
      );
      document.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
      document.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
      document.body.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: 1 })
      );
      expect(storageSet).not.toHaveBeenCalled();
      document.body.append(video);

      document.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
      video.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: -1 })
      );
      expect(storageSet).not.toHaveBeenCalled();
      document.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
      video.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, deltaY: 1 })
      );
      const contextMenu = new MouseEvent("contextmenu", { cancelable: true });
      document.dispatchEvent(contextMenu);
      expect(contextMenu.defaultPrevented).toBeTruthy();

      const untouchedContextMenu = new MouseEvent("contextmenu", {
        cancelable: true,
      });

      document.dispatchEvent(untouchedContextMenu);
      expect(untouchedContextMenu.defaultPrevented).toBeFalsy();
      const reverseRate = new WheelEvent("wheel", { bubbles: true, deltaY: 1 });
      Object.defineProperty(reverseRate, "ctrlKey", { value: true });
      video.dispatchEvent(reverseRate);
      expect(video.playbackRate).toBe(0.75);
      document.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
      cleanup();
    });
  });

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

  describe("overlay layout edge cases", () => {
    it("moves heuristic play controls and skips labeled control overlays", () => {
      const root = document.createElement("div");
      setMarkup(
        root,
        '<div class="play-parent"><div role="button" aria-label="Pause"></div></div><div data-visualcompletion role="button" aria-label="Control"></div>'
      );
      const video = document.createElement("video");
      root.append(video);
      const playParent = requireHtmlElement(root.querySelector(".play-parent"));
      const play = requireElement(playParent.firstElementChild);

      const control = requireHtmlElement(
        root.querySelector("[data-visualcompletion]")
      );

      setRect(video, rect(300, 600));
      setRect(playParent, rect(300, 600));
      setRect(play, rect(100, 100));

      modifyOverlayWithInstagramPlayControl(root, video);
      expect(playParent.style.bottom).toBe("70px");
      expect(control.style.bottom).toBe("");

      const noControls = document.createElement("div");
      expect(() => {
        modifyOverlayWithInstagramPlayControl(noControls, video);
      }).not.toThrow();
      root.insertAdjacentHTML(
        "beforeend",
        '<div><div role="button" aria-label="Pause"></div></div>'
      );
      const oversizedParent = requireElement(root.lastElementChild);
      const oversizedButton = requireElement(oversizedParent.firstElementChild);
      setRect(oversizedParent, rect(300, 600));
      setRect(oversizedButton, rect(250, 500));
      expect(() => {
        modifyOverlayWithInstagramPlayControl(root, video);
      }).not.toThrow();
      const smallButtonParent = document.createElement("div");
      const smallButton = document.createElement("div");
      smallButton.setAttribute("role", "button");
      smallButton.setAttribute("aria-label", "Pause");
      smallButtonParent.append(smallButton);
      root.append(smallButtonParent);
      setRect(smallButtonParent, rect(300, 600));
      setRect(smallButton, rect(50, 50));
      expect(() => {
        modifyOverlayWithInstagramPlayControl(root, video);
      }).not.toThrow();
    });

    it("uses the reels gradient class and warns when no gradient can be located", () => {
      history.replaceState(null, "", "/reels/reel-id");
      const root = document.createElement("div");
      setMarkup(
        root,
        '<div data-instancekey="x"><div data-visualcompletion><div role="presentation"></div></div></div><div class="xutac5l"></div>'
      );
      const video = document.createElement("video");
      root.append(video);
      setRect(video, rect(300, 600));
      const gradient = requireHtmlElement(root.querySelector(".xutac5l"));
      modifyOverlayWithInstagramPlayControl(root, video);
      expect(gradient.style.backgroundImage).toContain("linear-gradient");

      root.querySelector(".xutac5l")?.remove();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      modifyOverlayWithInstagramPlayControl(root, video);
      expect(warn).toHaveBeenCalledOnce();
    });

    it("uses a sized structural gradient fallback but ignores unrelated gradients", () => {
      history.replaceState(null, "", "/reels/reel-id");
      const root = document.createElement("div");
      setMarkup(
        root,
        '<div data-instancekey="x"><div data-visualcompletion><div role="presentation"><div style="background-image: linear-gradient(red, blue)"></div><div data-testid="gradient"></div></div></div></div>'
      );
      const video = document.createElement("video");
      root.append(video);

      const fallback = requireHtmlElement(
        root.querySelector("[data-testid=gradient]")
      );

      setRect(video, rect(300, 600));
      setRect(fallback, rect(300, 600));
      modifyOverlayWithInstagramPlayControl(root, video);
      expect(fallback.style.backgroundImage).toContain("linear-gradient");
    });

    it("adjusts story height for a message field and leaves unobstructed videos alone", () => {
      history.replaceState(null, "", "/stories/person/1");
      const root = document.createElement("div");
      setMarkup(
        root,
        '<button></button><div></div><header></header><div class="video-wrap"><video></video></div><div class="send"><textarea placeholder="Message"></textarea></div>'
      );
      document.body.append(root);
      const video = requireElement(root.querySelector("video"));
      const wrap = requireHtmlElement(video.parentElement);
      wrap.setAttribute("style", "height: auto");
      const message = requireElement(root.querySelector(".send"));
      setRect(video, rect(300, 600));
      setRect(wrap, rect(300, 600));
      setRect(root, rect(300, 600));
      setRect(message, rect(280, 40, 500));
      setRect(
        requireElement(root.querySelector("textarea")),
        rect(280, 40, 500)
      );

      modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
        video
      );
      expect(video.style.height).toBe("calc(100% - 116px)");
      expect(wrap.style.height).toBe("100%");

      const empty = document.createElement("video");
      expect(() => {
        modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
          empty
        );
      }).not.toThrow();
      expect(empty.style.height).toBe("");
    });

    it("adjusts a story like-button fallback and skips oversized blocker containers", () => {
      history.replaceState(null, "", "/stories/person/1");
      const root = document.createElement("div");
      setMarkup(
        root,
        '<button></button><div></div><header></header><div class="video-wrap"><video></video></div><div class="actions"><button><span><svg></svg></span></button></div>'
      );
      document.body.append(root);
      const video = requireElement(root.querySelector("video"));
      const actions = requireElement(root.querySelector(".actions"));
      const button = requireElement(actions.querySelector("button"));
      setRect(video, rect(300, 600));
      setRect(root, rect(300, 600));
      setRect(actions, rect(280, 40, 500));
      setRect(button, rect(280, 40, 500));
      modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
        video
      );
      expect(video.style.height).toContain("calc(100% -");

      const labeledRoot = document.createElement("div");
      setMarkup(
        labeledRoot,
        '<button></button><div></div><header></header><video></video><div class="actions"><button><svg aria-label="Like"></svg></button></div>'
      );
      document.body.append(labeledRoot);
      const labeledVideo = requireElement(labeledRoot.querySelector("video"));
      setRect(labeledVideo, rect(300, 600));
      setRect(labeledRoot, rect(300, 600));
      setRect(
        requireElement(labeledRoot.querySelector(".actions")),
        rect(280, 40, 500)
      );
      setRect(
        requireElement(labeledRoot.querySelector(".actions button")),
        rect(280, 40, 500)
      );
      modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
        labeledVideo
      );
      expect(labeledVideo.style.height).toContain("calc(100% -");

      const noBlocker = document.createElement("div");
      setMarkup(
        noBlocker,
        "<button></button><div></div><header></header><video></video>"
      );
      const unblocked = requireElement(noBlocker.querySelector("video"));
      expect(() => {
        modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
          unblocked
        );
      }).not.toThrow();
      expect(unblocked.style.height).toBe("");
    });

    it("stops story height inference at section boundaries", () => {
      history.replaceState(null, "", "/stories/person/1");
      const section = document.createElement("section");
      setMarkup(
        section,
        '<button></button><div class="player"><video></video></div><header></header><div class="send"><textarea placeholder="Message"></textarea></div>'
      );
      document.body.append(section);
      const video = requireElement(section.querySelector("video"));
      const textarea = requireElement(section.querySelector("textarea"));
      setRect(video, rect(300, 600));
      setRect(section, rect(300, 600));
      setRect(
        requireElement(section.querySelector(".send")),
        rect(280, 40, 500)
      );
      setRect(textarea, rect(280, 40, 500));
      modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
        video
      );
      expect(video.style.height).toContain("calc(100% -");
    });

    it("repositions Instagram's presentation overlay outside the reels route", () => {
      history.replaceState(null, "", "/p/post-id");
      const root = document.createElement("div");
      setMarkup(
        root,
        '<div data-instancekey="story"><div data-visualcompletion><div role="presentation"></div></div><div><button aria-label="Adjust volume"></button></div></div>'
      );
      const video = document.createElement("video");
      root.append(video);

      const instance = requireHtmlElement(
        root.querySelector("[data-instancekey]")
      );

      modifyOverlayWithInstagramPlayControl(root, video);
      expect(
        requireHtmlElement(instance.querySelector("[data-visualcompletion]"))
          .style.bottom
      ).toBe("70px");
      expect(
        requireHtmlElement(instance.querySelector("[role=presentation]")).style
          .bottom
      ).toBe("70px");
      expect(
        requireHtmlElement(
          requireHtmlElement(
            instance.querySelector("[aria-label='Adjust volume']")
          ).parentElement
        ).style.visibility
      ).toBe("hidden");
    });

    it("stops instance discovery at story sections and tolerates incomplete overlay markup", () => {
      history.replaceState(null, "", "/stories/person/1");
      const outer = document.createElement("div");
      setMarkup(
        outer,
        '<section><div class="player"><video></video></div></section><div data-instancekey="outside"><div data-visualcompletion></div></div>'
      );
      const video = requireElement(outer.querySelector("video"));
      modifyOverlayWithInstagramPlayControl(outer, video);
      const instanceKey = outer.querySelector("[data-instancekey]");

      if (!(instanceKey instanceof HTMLElement)) {
        throw new TypeError(
          "Expected Instagram instance-key markup in fixture"
        );
      }

      expect(instanceKey.dataset.instancekey).toBe("outside");

      const root = document.createElement("div");
      setMarkup(
        root,
        '<div class="player"><video></video></div><div data-instancekey="incomplete"><div data-visualcompletion></div></div>'
      );
      const nestedVideo = requireElement(root.querySelector("video"));
      expect(() => {
        modifyOverlayWithInstagramPlayControl(root, nestedVideo);
      }).not.toThrow();
      expect(() => {
        modifyOverlayWithInstagramPlayControl(
          document.createElement("div"),
          document.createElement("video")
        );
      }).not.toThrow();
    });

    it("handles non-HTML Instagram overlay nodes and missing volume controls", () => {
      history.replaceState(null, "", "/reels/reel-id");
      const root = document.createElement("div");
      const video = document.createElement("video");
      const instance = document.createElement("div");
      instance.dataset.instancekey = "svg-overlay";

      const visual = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );

      visual.dataset.visualcompletion = "";
      const presentation = document.createElement("div");
      presentation.setAttribute("role", "presentation");
      visual.append(presentation);
      instance.append(visual);

      const gradient = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );

      gradient.classList.add("xutac5l");
      root.append(video, instance, gradient);

      expect(() => {
        modifyOverlayWithInstagramPlayControl(root, video);
      }).not.toThrow();
      expect(gradient.getAttribute("style")).toBeNull();
    });
  });

  describe("extension entrypoints", () => {
    it("initializes missing background settings while preserving stored overrides", async () => {
      storageGet.mockResolvedValueOnce({
        volumeLevel: 0.3,
      });
      await initializeSettings();
      await Promise.resolve();
      await Promise.resolve();
      expect(storageGet).toHaveBeenCalledWith(Object.keys(DEFAULTS));
      await vi.waitFor(() => {
        expect(storageSet).toHaveBeenCalledWith({
          ...DEFAULTS,
          volumeLevel: 0.3,
        });
      });
    });

    it("boots the content script and responds to dynamic videos and settings", async () => {
      vi.useFakeTimers();

      const raf = vi.fn<(callback: FrameRequestCallback) => number>();

      vi.stubGlobal("requestAnimationFrame", raf);
      await initializeContentScript();

      const dynamicVideoRoot = document.createElement("div");
      dynamicVideoRoot.className = "EmbedVideo";
      const dynamicVideo = document.createElement("video");
      dynamicVideoRoot.append(dynamicVideo);
      const standaloneVideo = document.createElement("video");
      document.body.append(
        standaloneVideo,
        dynamicVideoRoot,
        document.createTextNode("ignored")
      );
      await vi.waitFor(() => {
        expect(raf).toHaveBeenCalledOnce();
      });
      const animationFrame = raf.mock.calls[0]?.[0];

      if (!animationFrame) {
        throw new TypeError("Expected a queued animation frame");
      }

      animationFrame(0);
      expect(dynamicVideo.dataset.igvcInit).toBe("1");

      const changed = {
        ...settings(),
        playbackRate: 2,
        volumeLevel: 0.25,
      };

      storageGet.mockResolvedValueOnce(changed);

      const settingsListener = addStorageListener.mock.calls[0]?.[0];

      if (!settingsListener) {
        throw new TypeError("Expected the storage change listener");
      }

      settingsListener({ playbackRate: {}, volumeLevel: {} });
      await Promise.resolve();
      await Promise.resolve();
      expect([dynamicVideo.volume, dynamicVideo.playbackRate]).toStrictEqual([
        0.25, 2,
      ]);

      const disabled = {
        ...changed,
        playbackRate: 3,
        rememberPlaybackRate: false,
        rememberVolumeLevel: false,
        volumeLevel: 0.75,
      };

      storageGet.mockResolvedValueOnce(disabled);
      settingsListener({ playbackRate: {}, volumeLevel: {} });
      await Promise.resolve();
      await Promise.resolve();
      expect([dynamicVideo.volume, dynamicVideo.playbackRate]).toStrictEqual([
        0.25, 2,
      ]);

      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      vi.advanceTimersByTime(5000);
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(5000);
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  incapacitateStoryVideoPausingOverlays,
  modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls,
} from "@/entrypoints/content/story-layout";

const rect = (width: number, height: number, top = 0): DOMRect =>
  new DOMRect(0, top, width, height);

const setRect = (element: Element, value: DOMRect): void => {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(value);
};

const createStory = (controls: string) => {
  const root = document.createElement("div");

  const parsed = new DOMParser().parseFromString(
    `<button></button><div class="player"><video></video></div><header></header>${controls}`,
    "text/html"
  );

  root.replaceChildren(...parsed.body.childNodes);
  document.body.append(root);

  const video = root.querySelector("video");

  if (!video) {
    throw new TypeError("Expected a video in story fixture");
  }

  return { root, video };
};

describe("story layout", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("hides only sibling overlays and tolerates a detached video", () => {
    const parent = document.createElement("div");
    const video = document.createElement("video");
    const overlay = document.createElement("div");
    parent.append(video, overlay);

    incapacitateStoryVideoPausingOverlays(video);

    incapacitateStoryVideoPausingOverlays(document.createElement("video"));

    expect(video.style.visibility).toBe("");
    expect(overlay.style.visibility).toBe("hidden");
  });

  it("reserves room below a story video for the message composer", () => {
    const { root, video } = createStory(
      '<div class="send"><textarea placeholder="Message"></textarea></div>'
    );

    const wrap = video.parentElement;
    const composer = root.querySelector(".send");
    const textarea = root.querySelector("textarea");

    if (!(wrap instanceof HTMLElement) || !composer || !textarea) {
      throw new TypeError("Expected message composer fixture");
    }

    wrap.style.height = "auto";
    setRect(root, rect(300, 600));
    setRect(video, rect(300, 600));
    setRect(wrap, rect(300, 600));
    setRect(composer, rect(280, 40, 500));
    setRect(textarea, rect(280, 40, 500));

    modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(video);

    expect(video.style.height).toBe("calc(100% - 116px)");
    expect(wrap.style.height).toBe("100%");
  });

  it("uses a like button as the fallback blocker and ignores stories without blockers", () => {
    const { root, video } = createStory(
      '<div class="actions"><button><span><svg></svg></span></button></div>'
    );

    const actions = root.querySelector(".actions");
    const button = actions?.querySelector("button");

    if (!actions || !button) {
      throw new TypeError("Expected like button fixture");
    }

    setRect(root, rect(300, 600));
    setRect(video, rect(300, 600));
    setRect(actions, rect(280, 40, 500));
    setRect(button, rect(280, 40, 500));
    modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(video);
    expect(video.style.height).toContain("calc(100% -");

    const unblocked = createStory("").video;
    modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls(
      unblocked
    );
    expect(unblocked.style.height).toBe("");
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  modifyOverlayWithInstagramPlayControl,
  modifyVideoHeightIfSendMessageBoxOrLikeButtonIsBlockingVideoControls,
} from "@/entrypoints/content/overlay-fixes";

import {
  setupTestEnvironment,
  rect,
  requireElement,
  requireHtmlElement,
  setMarkup,
  setRect,
} from "./test-helpers";

describe("ig-video-controls", () => {
  setupTestEnvironment();

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
  });
});

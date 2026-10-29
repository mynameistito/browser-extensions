import { describe, expect, it } from "vitest";

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
});

import { describe, expect, it } from "vitest";

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
  setupTestEnvironment,
  rect,
  requireElement,
  setMarkup,
  setRect,
} from "./test-helpers";

describe("ig-video-controls", () => {
  setupTestEnvironment();

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
});

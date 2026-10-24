import type { InboundContentMessage } from "@/utils/messages.ts";

const applyMuteToAllVideos = (muted: boolean): void => {
  for (const video of document.querySelectorAll("video")) {
    video.muted = muted;
  }
};

/** Installs handlers that synchronize YouTube video elements with tab mute state. */
export const installYoutubeContentHandlers = (): void => {
  let isMuted = false;

  // Watch for dynamically added <video> elements; only fire when a video
  // node is actually added, and only when muted, to avoid unnecessary scans.
  const observer = new MutationObserver((mutations) => {
    if (!isMuted) {
      return;
    }

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (
          node instanceof HTMLVideoElement ||
          (node instanceof HTMLElement && node.querySelector("video") !== null)
        ) {
          applyMuteToAllVideos(true);

          return;
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Handle YouTube SPA navigation
  document.addEventListener("yt-navigate-finish", () => {
    applyMuteToAllVideos(isMuted);
  });

  // Handle messages from service worker
  chrome.runtime.onMessage.addListener((message: InboundContentMessage) => {
    if (message.type === "SET_MUTED") {
      isMuted = message.muted;
      applyMuteToAllVideos(isMuted);
    }
  });
};

export default defineContentScript({
  allFrames: true,
  main: installYoutubeContentHandlers,
  matches: ["*://*.youtube.com/*"],
  runAt: "document_idle",
});

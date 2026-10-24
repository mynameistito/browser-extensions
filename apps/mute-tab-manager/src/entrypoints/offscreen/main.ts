// Chrome-only: detect system dark mode in a page context (service workers
// lack DOM access) and report results to the background script.

import type { InboundOffscreenMessage } from "@/utils/messages.ts";

const mq = window.matchMedia("(prefers-color-scheme: dark)");

const send = (isDark: boolean): Promise<void> =>
  chrome.runtime.sendMessage({ isDark, type: "DARK_MODE_RESPONSE" });

const reportDarkMode = async (): Promise<void> => {
  try {
    await send(mq.matches);
  } catch {
    // Ignore: background may have restarted.
  }
};

void reportDarkMode();
mq.addEventListener("change", async (e) => {
  try {
    await send(e.matches);
  } catch {
    // Ignore: background may have restarted.
  }
});

chrome.runtime.onMessage.addListener((message: InboundOffscreenMessage) => {
  if (message.type === "GET_DARK_MODE") {
    void reportDarkMode();
  }
});

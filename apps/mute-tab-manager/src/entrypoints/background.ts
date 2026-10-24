import { updateBadgeAndIcon } from "@/utils/badge.ts";
import {
  COMMAND_TOGGLE_MUTE,
  CONTEXT_MENU_MUTE_ALL,
  CONTEXT_MENU_TOGGLE_ID,
  STORAGE_KEY_DARK_MODE,
} from "@/utils/constants.ts";
import type { InboundServiceWorkerMessage } from "@/utils/messages.ts";
import {
  muteAllTabs,
  sendMuteToContentScript,
  toggleMuteActiveTab,
} from "@/utils/mute.ts";
import { isTabMuted, removeTabFromStorage } from "@/utils/storage.ts";

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html" as const;

// ── Dark mode detection ────────────────────────────────────────────────────

/**
 * Firefox MV3 supports matchMedia() natively inside the service worker.
 */
const initFirefoxDarkModeDetection = (): void => {
  if (typeof matchMedia === "undefined") {
    return;
  }
  const mq = matchMedia("(prefers-color-scheme: dark)");
  chrome.storage.session.set({ [STORAGE_KEY_DARK_MODE]: mq.matches });
  mq.addEventListener("change", (e) => {
    chrome.storage.session.set({ [STORAGE_KEY_DARK_MODE]: e.matches });
  });
};

/**
 * Chrome service workers cannot access matchMedia. We host an offscreen
 * document that runs matchMedia and reports the result back.
 */
const ensureOffscreenDocument = async (): Promise<void> => {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  await (existingContexts.length === 0
    ? chrome.offscreen.createDocument({
        justification: "Detect system dark mode preference",
        reasons: [chrome.offscreen.Reason.MATCH_MEDIA],
        url: chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
      })
    : chrome.runtime.sendMessage({ type: "GET_DARK_MODE" }));
};

// ── Background entrypoint ──────────────────────────────────────────────────

export default defineBackground({
  async main() {
    const isFirefox = import.meta.env.BROWSER === "firefox";

    // Register message listener BEFORE ensureOffscreenDocument to avoid
    // missing DARK_MODE_RESPONSE (race condition if offscreen already exists
    // or when newly created).
    chrome.runtime.onMessage.addListener(
      (message: InboundServiceWorkerMessage) => {
        if (message.type === "DARK_MODE_RESPONSE") {
          void (async () => {
            try {
              await chrome.storage.session.set({
                [STORAGE_KEY_DARK_MODE]: message.isDark,
              });
            } catch (error) {
              console.error(error);
            }
          })();
        }
        return false;
      }
    );

    // Re-initialise on every service-worker startup so theme state is correct
    // after browser restarts (session storage is cleared on restart).
    if (isFirefox) {
      initFirefoxDarkModeDetection();
    } else {
      await ensureOffscreenDocument();
    }

    chrome.runtime.onInstalled.addListener(async () => {
      chrome.contextMenus.create({
        contexts: ["action"],
        id: CONTEXT_MENU_TOGGLE_ID,
        title: "Toggle Mute",
      });
      chrome.contextMenus.create({
        contexts: ["action"],
        id: CONTEXT_MENU_MUTE_ALL,
        title: "Mute All Tabs",
      });

      // Dark-mode detection is already initialized in main() for both Firefox
      // and Chrome. No need to repeat it here.
      if (!isFirefox) {
        await ensureOffscreenDocument();
      }
    });

    chrome.action.onClicked.addListener(async () => {
      await toggleMuteActiveTab();
    });

    chrome.commands.onCommand.addListener(async (command) => {
      if (command === COMMAND_TOGGLE_MUTE) {
        await toggleMuteActiveTab();
      }
    });

    chrome.contextMenus.onClicked.addListener(async (info) => {
      if (info.menuItemId === CONTEXT_MENU_TOGGLE_ID) {
        await toggleMuteActiveTab();
      } else if (info.menuItemId === CONTEXT_MENU_MUTE_ALL) {
        await muteAllTabs();
      }
    });

    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      const muted = await isTabMuted(activeInfo.tabId);
      await updateBadgeAndIcon(activeInfo.tabId, muted);
    });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
      const muted = await isTabMuted(tabId);
      if (!muted) {
        return;
      }

      // Re-inject mute state after page load (handles YouTube reloads)
      if (changeInfo.status === "complete") {
        await sendMuteToContentScript(tabId, true);
        await updateBadgeAndIcon(tabId, true);
      }

      // Re-inject mute state after SPA navigation (handles YouTube pushState)
      if (changeInfo.url !== undefined && changeInfo.url !== null) {
        await sendMuteToContentScript(tabId, true);
      }
    });

    chrome.tabs.onRemoved.addListener(async (tabId) => {
      await removeTabFromStorage(tabId);
    });
  },
  type: "module",
});

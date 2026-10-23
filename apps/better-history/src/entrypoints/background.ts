import { registerToolbarAction } from "@/background/action";
import {
  rebuildContextMenus,
  registerContextMenuClicks,
} from "@/background/context-menus";
import {
  ensureAlarm,
  registerAlarmHandler,
  registerCleanupMessages,
  runOnCloseCleanup,
} from "@/background/enforcement";
import { seedDefaults } from "@/background/install";

/** Register lifecycle listeners and background maintenance handlers. */
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void (async () => {
      await seedDefaults();
      await rebuildContextMenus();
      await ensureAlarm();
    })();
  });

  browser.runtime.onStartup.addListener(() => {
    void (async () => {
      await ensureAlarm();
      await rebuildContextMenus();
      await runOnCloseCleanup();
    })();
  });

  browser.runtime.onSuspend.addListener(() => {
    void (async () => {
      try {
        await runOnCloseCleanup();
      } catch {
        // MV3 suspend work is best-effort; startup catchup will retry.
      }
    })();
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      void (async () => {
        try {
          await rebuildContextMenus();
        } catch {
          // ignore
        }
      })();
    }
  });

  registerAlarmHandler();
  registerCleanupMessages();
  registerContextMenuClicks();
  registerToolbarAction();
});

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

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await seedDefaults();
    await rebuildContextMenus();
    await ensureAlarm();
  });

  browser.runtime.onStartup.addListener(async () => {
    await ensureAlarm();
    await rebuildContextMenus();
    await runOnCloseCleanup();
  });

  browser.runtime.onSuspend.addListener(() => {
    runOnCloseCleanup().catch(() => {
      // MV3 suspend work is best-effort; startup catchup will retry.
    });
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      rebuildContextMenus().catch(() => {
        // ignore
      });
    }
  });

  registerAlarmHandler();
  registerCleanupMessages();
  registerContextMenuClicks();
  registerToolbarAction();
});

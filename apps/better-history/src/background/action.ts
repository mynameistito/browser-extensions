import { tabs } from "@/lib/browser-api";

export const registerToolbarAction = (): void => {
  if (!import.meta.env.FIREFOX) {
    return;
  }
  browser.action.onClicked.addListener(async () => {
    await tabs.create({ url: browser.runtime.getURL("/history.html") });
  });
};

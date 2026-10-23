import { tabs } from "@/lib/browser-api";

/** Register the toolbar click behavior for Firefox's extension action. */
export const registerToolbarAction = (): void => {
  if (!import.meta.env.FIREFOX) {
    return;
  }

  browser.action.onClicked.addListener(() => {
    void tabs.create({ url: browser.runtime.getURL("/history.html") });
  });
};

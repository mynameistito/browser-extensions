import { tabs } from "@/lib/browser-api";

export function registerToolbarAction() {
  if (!import.meta.env.FIREFOX) {
    return;
  }
  browser.action.onClicked.addListener(async () => {
    await tabs.create({ url: browser.runtime.getURL("/history.html") });
  });
}

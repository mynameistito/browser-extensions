const X_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
]);

const STATUS_PATH = /^\/[^/]+\/status\/\d+\/?$/u;

/** Clipboard interface required by the patch. */
export interface ClipboardWriter {
  /** Write text to the browser clipboard. */
  writeText: (text: string) => Promise<void>;
}

/**
 * Remove the query string from an X/Twitter status URL.
 * @param text - Clipboard text to inspect.
 * @returns A clean status URL when the whole input is a tracked X link, otherwise the original text.
 */
export const cleanStatusUrl = (text: string): string => {
  let url: URL;

  try {
    url = new URL(text);
  } catch {
    return text;
  }

  if (
    !X_HOSTS.has(url.hostname.toLowerCase()) ||
    !STATUS_PATH.test(url.pathname) ||
    url.search.length === 0
  ) {
    return text;
  }

  url.search = "";

  return url.toString();
};

/**
 * Remove tracking query parameters from the current address-bar status URL.
 * @param history - The page history API.
 * @param currentUrl - The current absolute URL.
 */
export const cleanStatusAddressBarUrl = (
  history: Pick<History, "state" | "replaceState">,
  currentUrl: string
): void => {
  const cleanUrl = cleanStatusUrl(currentUrl);

  if (cleanUrl !== currentUrl) {
    history.replaceState(history.state, "", cleanUrl);
  }
};

/**
 * Wrap clipboard writes so X post links are cleaned before they are copied.
 * @param clipboard - The page's clipboard object.
 */
export const patchClipboardWriter = (clipboard: ClipboardWriter): void => {
  const originalWriteText = clipboard.writeText.bind(clipboard);

  Object.defineProperty(clipboard, "writeText", {
    configurable: true,
    async value(text: string) {
      await originalWriteText(cleanStatusUrl(text));
    },
  });
};

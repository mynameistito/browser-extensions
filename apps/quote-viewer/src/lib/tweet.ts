const DEFAULT_HANDLE = "x";
const HANDLE_RE = /@(?<handle>\w+)(?:[\s·]|$)/u;

const findTweetId = (
  article: Element,
  twitterHandle: string
): string | null => {
  const selector = `a[href*="${
    twitterHandle === DEFAULT_HANDLE ? "" : twitterHandle
  }/status"]`;

  const href = article
    .querySelector<HTMLAnchorElement>(selector)
    ?.getAttribute("href");

  if (href === null || href === undefined || href.length === 0) {
    return null;
  }

  try {
    const url = new URL(href, window.location.origin);
    const parts = url.pathname.split("/").filter(Boolean);
    const statusIndex = parts.indexOf("status");

    return statusIndex === -1 ? null : (parts[statusIndex + 1] ?? null);
  } catch {
    return null;
  }
};

/** Information extracted from a quoted tweet. */
export interface TweetDetails {
  tweetId: string | null;
  twitterHandle: string;
}

/** Extracts the author handle and status ID from a tweet article.
 * @param article - The article element for the tweet.
 * @returns The extracted handle and status ID, when present.
 */
export const getTweetDetails = (article: Element): TweetDetails => {
  let twitterHandle = DEFAULT_HANDLE;

  const handleElement = article.querySelector(
    '[data-testid*="User-Name"] > div:nth-child(2)'
  );

  const handleText = handleElement?.textContent;

  if (
    handleText !== null &&
    handleText !== undefined &&
    handleText.length > 0
  ) {
    const matchedHandle = HANDLE_RE.exec(handleText)?.groups?.handle;

    if (matchedHandle !== undefined && matchedHandle.length > 0) {
      twitterHandle = matchedHandle;
    }
  }

  return { tweetId: findTweetId(article, twitterHandle), twitterHandle };
};

/** Navigates to the quote list for a tweet and resets scroll position.
 * @param twitterHandle - The tweet author's handle.
 * @param tweetId - The tweet's status ID.
 * @returns Nothing.
 */
export const viewQuotedTweets = (
  twitterHandle: string,
  tweetId: string
): void => {
  const newPath = `/${twitterHandle}/status/${tweetId}/quotes`;
  window.history.pushState({}, "", newPath);
  window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  window.scrollTo(0, 0);
};

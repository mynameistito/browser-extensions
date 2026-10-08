const DEFAULT_HANDLE = "x";
const HANDLE_RE = /@(?<handle>[a-zA-Z0-9_]+)(?:[\s·]|$)/u;

export interface TweetDetails {
  tweetId: string | null;
  twitterHandle: string;
}

export const getTweetDetails = (article: Element): TweetDetails => {
  let twitterHandle = DEFAULT_HANDLE;
  let tweetId: string | null = null;

  const handleElement = article.querySelector(
    '[data-testid*="User-Name"] > div:nth-child(2)'
  );
  if (handleElement?.textContent) {
    const matchedHandle = HANDLE_RE.exec(handleElement.textContent)?.groups
      ?.handle;
    if (matchedHandle) {
      twitterHandle = matchedHandle;
    }
  }

  const selector = `a[href*="${
    twitterHandle === DEFAULT_HANDLE ? "" : twitterHandle
  }/status"]`;

  const tweetAnchor = article.querySelector<HTMLAnchorElement>(selector);
  if (tweetAnchor) {
    const href = tweetAnchor.getAttribute("href");
    if (href) {
      try {
        const url = new URL(href, window.location.origin);
        const parts = url.pathname.split("/").filter(Boolean);
        const statusIdx = parts.indexOf("status");
        if (statusIdx !== -1) {
          const candidate = parts[statusIdx + 1];
          if (candidate) {
            tweetId = candidate;
          }
        }
      } catch {
        // ignore invalid URLs
      }
    }
  }

  return { tweetId, twitterHandle };
};

export const viewQuotedTweets = (
  twitterHandle: string,
  tweetId: string
): void => {
  const newPath = `/${twitterHandle}/status/${tweetId}/quotes`;
  window.history.replaceState({}, "", newPath);
  window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  window.scrollTo(0, 0);
};

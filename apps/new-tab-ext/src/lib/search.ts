import { Data, Effect } from "effect";

import type { SearchProvider } from "./preferences";

/** A supported destination for a search query. */
export type SearchTarget = "web" | "chatgpt";

/** The empty query value retained when a search is rejected. */
interface EmptySearchQueryDetails {
  readonly query: string;
}

/** The failure returned when a search is attempted without a query. */
export class EmptySearchQuery extends Data.TaggedError(
  "EmptySearchQuery"
)<EmptySearchQueryDetails> {}

/**
 * Build a destination URL from a non-empty user query.
 * @param target - Whether to open web results or a ChatGPT prompt.
 * @param query - Search text entered by the user.
 * @param provider - Web search provider, defaulting to Google.
 * @returns An Effect containing the destination URL or an empty-query error.
 */
export const createSearchUrl = (
  target: SearchTarget,
  query: string,
  provider: SearchProvider = "google"
): Effect.Effect<URL, EmptySearchQuery> =>
  Effect.gen(function* createSearchUrlProgram() {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length === 0) {
      return yield* Effect.fail(
        new EmptySearchQuery({ query: normalizedQuery })
      );
    }

    const webSearchUrls = {
      bing: "https://www.bing.com/search",
      duckduckgo: "https://duckduckgo.com/",
      google: "https://www.google.com/search",
    } satisfies Record<SearchProvider, string>;

    const url = new URL(
      target === "web" ? webSearchUrls[provider] : "https://chatgpt.com/"
    );

    url.searchParams.set("q", normalizedQuery);

    return url;
  });

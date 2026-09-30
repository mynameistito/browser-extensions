import { Data, Effect } from "effect";

/** A supported destination for a search query. */
export type SearchTarget = "web" | "chatgpt";

/** The failure returned when a search is attempted without a query. */
export class EmptySearchQuery extends Data.TaggedError("EmptySearchQuery")<
  Record<never, never>
> {}

/** Build a destination URL from a non-empty user query. */
export const createSearchUrl = (
  target: SearchTarget,
  query: string
): Effect.Effect<URL, EmptySearchQuery> =>
  Effect.gen(function* createSearchUrlProgram() {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length === 0) {
      return yield* Effect.fail(new EmptySearchQuery());
    }

    const url = new URL(
      target === "web"
        ? "https://www.google.com/search"
        : "https://chatgpt.com/"
    );
    url.searchParams.set("q", normalizedQuery);

    return url;
  });

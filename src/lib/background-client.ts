import { Data, Effect, Either, Schema } from "effect";

import { storage } from "#imports";

import { CommonsResponseSchema, parseBackgroundResponse } from "./backgrounds";
import type { BackgroundPhoto } from "./backgrounds";

const BACKGROUND_CACHE_DURATION = 24 * 60 * 60 * 1000;
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

interface BackgroundCache {
  readonly fetchedAt: number;
  readonly photos: readonly BackgroundPhoto[];
}

const backgroundsItem = storage.defineItem<BackgroundCache | null>(
  "local:background-cache",
  { fallback: null, version: 1 }
);

/** Typed failure from Wikimedia Commons or its local metadata cache. */
export class BackgroundRequestError extends Data.TaggedError(
  "BackgroundRequestError"
)<{
  readonly operation: "request" | "cache";
  readonly cause: unknown;
}> {}

const createCommonsUrl = (): URL => {
  const url = new URL(COMMONS_API);
  const parameters = new Map([
    ["action", "query"],
    ["generator", "categorymembers"],
    ["gcmtitle", "Category:Featured_pictures_of_landscapes"],
    ["gcmtype", "file"],
    ["gcmlimit", "30"],
    ["prop", "imageinfo"],
    ["iiprop", "url|extmetadata"],
    ["iiurlwidth", "2560"],
    ["format", "json"],
    ["origin", "*"],
    ["maxlag", "5"],
  ]);

  for (const [key, value] of parameters) {
    url.searchParams.set(key, value);
  }

  return url;
};

/** Load cached landscape metadata or refresh Wikimedia Commons once per day. */
export const loadBackgroundPhotos = (): Effect.Effect<
  readonly BackgroundPhoto[],
  BackgroundRequestError
> =>
  Effect.gen(function* loadBackgroundPhotosProgram() {
    const cacheResult = yield* Effect.either(
      Effect.tryPromise({
        try: () => backgroundsItem.getValue(),
        catch: (cause) =>
          new BackgroundRequestError({ operation: "cache", cause }),
      })
    );
    const cached = cacheResult._tag === "Right" ? cacheResult.right : null;

    if (cached && Date.now() - cached.fetchedAt < BACKGROUND_CACHE_DURATION) {
      return cached.photos;
    }

    const responseResult = yield* Effect.either(
      Effect.tryPromise({
        try: async (): Promise<readonly BackgroundPhoto[]> => {
          const response = await fetch(createCommonsUrl(), {
            headers: {
              "Api-User-Agent":
                "NewTabExt/0.1.0 (https://github.com/mynameistito/new-tab-ext)",
            },
            signal: AbortSignal.timeout(15_000),
          });

          if (!response.ok) {
            throw new Error(
              `Wikimedia Commons returned HTTP ${response.status}.`
            );
          }

          const payload: unknown = await response.json();
          const decoded = Schema.decodeUnknownEither(CommonsResponseSchema)(
            payload
          );

          if (Either.isLeft(decoded)) {
            throw new Error(
              "Wikimedia Commons returned malformed image metadata."
            );
          }

          const photos = parseBackgroundResponse(decoded.right);

          if (photos.length === 0) {
            throw new Error(
              "Commons response had no attributable landscape images."
            );
          }

          return photos;
        },
        catch: (cause) =>
          new BackgroundRequestError({ operation: "request", cause }),
      })
    );

    if (responseResult._tag === "Left") {
      if (cached) {
        return cached.photos;
      }

      return yield* Effect.fail(responseResult.left);
    }

    const photos = responseResult.right;

    yield* Effect.either(
      Effect.tryPromise({
        try: () => backgroundsItem.setValue({ fetchedAt: Date.now(), photos }),
        catch: (cause) =>
          new BackgroundRequestError({ operation: "cache", cause }),
      })
    );

    return photos;
  });

import { Effect, Either } from "effect";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { loadBackgroundPhotos } from "../../src/lib/background-client";
import {
  clearWxtStorage,
  failWxtStorage,
  seedWxtStorage,
} from "../helpers/wxt-imports";

const photo = {
  title: "File:Mountain.jpg",
  imageinfo: [
    {
      thumburl: "https://thumb.wikimedia.org/mountain.jpg",
      descriptionurl: "https://commons.wikimedia.org/wiki/File:Mountain.jpg",
      extmetadata: {
        Artist: { value: "Photographer" },
        LicenseShortName: { value: "CC BY-SA 4.0" },
        LicenseUrl: {
          value: "https://creativecommons.org/licenses/by-sa/4.0/",
        },
      },
    },
  ],
};

const commonsPayload = { query: { pages: { "42": photo } } };
const parsedPhoto = {
  title: "Mountain.jpg",
  imageUrl: "https://thumb.wikimedia.org/mountain.jpg",
  pageUrl: "https://commons.wikimedia.org/wiki/File:Mountain.jpg",
  artist: "Photographer",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};
type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

const jsonResponse = (
  payload: { readonly [key: string]: JsonValue },
  status = 200
): Response => Response.json(payload, { status });

describe("Wikimedia Commons client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  });

  test("returns metadata from a fresh cache without fetching", async () => {
    seedWxtStorage("local:background-cache", {
      fetchedAt: Date.now() - 1000,
      photos: [parsedPhoto],
    });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(Effect.runPromise(loadBackgroundPhotos())).resolves.toEqual([
      parsedPhoto,
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("fetches valid metadata with request headers and persists it", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(commonsPayload));
    vi.stubGlobal("fetch", fetchMock);

    await expect(Effect.runPromise(loadBackgroundPhotos())).resolves.toEqual([
      parsedPhoto,
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "Api-User-Agent": expect.stringContaining("NewTabExt"),
    });
  });

  test.each([
    [
      "HTTP failure",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 503)),
    ],
    [
      "network failure",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
    ],
    [
      "invalid JSON",
      vi.fn<typeof fetch>().mockResolvedValue(new Response("not-json")),
    ],
    [
      "invalid schema",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({})),
    ],
    [
      "no attributable photos",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse({ query: { pages: {} } })),
    ],
  ])(
    "reports a typed failure for %s without a cache",
    async (_name, fetchMock) => {
      vi.stubGlobal("fetch", fetchMock);

      const result = await Effect.runPromise(
        Effect.either(loadBackgroundPhotos())
      );
      expect(Either.isLeft(result)).toBe(true);
    }
  );

  test("uses expired cache when a refresh fails", async () => {
    seedWxtStorage("local:background-cache", {
      fetchedAt: Date.now() - 25 * 60 * 60 * 1000,
      photos: [parsedPhoto],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 500))
    );

    await expect(Effect.runPromise(loadBackgroundPhotos())).resolves.toEqual([
      parsedPhoto,
    ]);
  });

  test("continues when local cache reads or writes fail", async () => {
    failWxtStorage("local:background-cache", "read", new Error("read failed"));
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(commonsPayload))
    );
    await expect(Effect.runPromise(loadBackgroundPhotos())).resolves.toEqual([
      parsedPhoto,
    ]);

    clearWxtStorage();
    failWxtStorage(
      "local:background-cache",
      "write",
      new Error("write failed")
    );
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(commonsPayload))
    );
    await expect(Effect.runPromise(loadBackgroundPhotos())).resolves.toEqual([
      parsedPhoto,
    ]);
  });
});

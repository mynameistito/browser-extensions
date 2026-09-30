import { describe, expect, test } from "bun:test";

import { Either, Schema } from "effect";

import {
  chooseDailyBackground,
  CommonsResponseSchema,
  parseBackgroundResponse,
} from "../../src/lib/backgrounds";

const commonsPayload = {
  query: {
    pages: {
      "42": {
        title: "File:Mountain.jpg",
        imageinfo: [
          {
            thumburl: "https://thumb.wikimedia.org/example.jpg",
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:Mountain.jpg",
            extmetadata: {
              Artist: { value: "<a>Photographer</a> &amp; co" },
              LicenseShortName: { value: "CC BY-SA 4.0" },
              LicenseUrl: {
                value: "https://creativecommons.org/licenses/by-sa/4.0/",
              },
            },
          },
        ],
      },
    },
  },
};

describe("Wikimedia Commons backgrounds", () => {
  test("decodes and preserves attribution for eligible photos", () => {
    const decoded = Schema.decodeUnknownEither(CommonsResponseSchema)(
      commonsPayload
    );

    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded)) {
      expect(parseBackgroundResponse(decoded.right)).toEqual([
        {
          title: "Mountain.jpg",
          imageUrl: "https://thumb.wikimedia.org/example.jpg",
          pageUrl: "https://commons.wikimedia.org/wiki/File:Mountain.jpg",
          artist: "Photographer & co",
          license: "CC BY-SA 4.0",
          licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        },
      ]);
    }
  });

  test("rejects malformed metadata and rotates deterministically", () => {
    expect(
      Either.isLeft(Schema.decodeUnknownEither(CommonsResponseSchema)({}))
    ).toBe(true);

    const photos = parseBackgroundResponse(
      Schema.decodeUnknownSync(CommonsResponseSchema)(commonsPayload)
    );

    expect(chooseDailyBackground(photos, 0, 0)?.title).toBe("Mountain.jpg");
    expect(chooseDailyBackground([], 0, 0)).toBeNull();
  });
});

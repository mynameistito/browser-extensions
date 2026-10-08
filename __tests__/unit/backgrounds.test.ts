import { Either, Schema } from "effect";
import { describe, expect, test } from "vitest";

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
    expect(chooseDailyBackground([...photos, ...photos], 0, -1)).toBeNull();
  });

  test("filters unsafe URLs and missing attribution while decoding artist text", () => {
    const payload = {
      query: {
        pages: {
          missing: {
            title: "File:Missing.jpg",
            imageinfo: [
              {
                thumburl: "https://thumb.wikimedia.org/missing.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/Missing",
                extmetadata: {},
              },
            ],
          },
          unsafe: {
            title: "File:Unsafe.jpg",
            imageinfo: [
              {
                thumburl: `http:${"//thumb.wikimedia.org/unsafe.jpg"}`,
                descriptionurl: "https://commons.wikimedia.org/wiki/Unsafe",
                extmetadata: {
                  Artist: { value: "Artist" },
                  LicenseShortName: { value: "CC" },
                  LicenseUrl: { value: `${"java"}script:alert(1)` },
                },
              },
            ],
          },
          malformed: {
            title: "File:Malformed.jpg",
            imageinfo: [],
          },
        },
      },
    };

    expect(
      parseBackgroundResponse(
        Schema.decodeUnknownSync(CommonsResponseSchema)(payload)
      )
    ).toEqual([]);
  });

  test("cleans supported HTML entities and rejects invalid origins", () => {
    const payload = {
      query: {
        pages: {
          encoded: {
            title: "Landscape.jpg",
            imageinfo: [
              {
                thumburl: "https://thumb.wikimedia.org/image.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/Image",
                extmetadata: {
                  Artist: {
                    value:
                      "A &quot;B&quot; &#039;C&#039; &apos;D&apos; &lt;E&gt; &amp; F",
                  },
                  LicenseShortName: { value: "CC" },
                  LicenseUrl: { value: "https://creativecommons.org/license" },
                },
              },
            ],
          },
          wrongHost: {
            title: "File:Wrong.jpg",
            imageinfo: [
              {
                thumburl: "https://example.com/image.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/Wrong",
                extmetadata: {
                  Artist: { value: "Artist" },
                  LicenseShortName: { value: "CC" },
                  LicenseUrl: { value: "https://creativecommons.org/license" },
                },
              },
            ],
          },
          malformedUrl: {
            title: "File:Malformed-url.jpg",
            imageinfo: [
              {
                thumburl: "not a valid URL",
                descriptionurl: "https://commons.wikimedia.org/wiki/Invalid",
                extmetadata: {
                  Artist: { value: "Artist" },
                  LicenseShortName: { value: "CC" },
                  LicenseUrl: { value: "https://creativecommons.org/license" },
                },
              },
            ],
          },
        },
      },
    };

    expect(
      parseBackgroundResponse(
        Schema.decodeUnknownSync(CommonsResponseSchema)(payload)
      )[0]?.artist
    ).toBe("A \"B\" 'C' 'D' <E> & F");
  });
});

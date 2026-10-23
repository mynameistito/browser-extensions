import { Either, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  chooseDailyBackground,
  CommonsResponseSchema,
  parseBackgroundResponse,
} from "../../src/lib/backgrounds";
import {
  cleanupTestEnvironment,
  setupTestEnvironment,
} from "../helpers/test-environment";

const commonsPayload = {
  query: {
    pages: {
      "42": {
        imageinfo: [
          {
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:Mountain.jpg",
            extmetadata: {
              Artist: { value: "<a>Photographer</a> &amp; co" },
              LicenseShortName: { value: "CC BY-SA 4.0" },
              LicenseUrl: {
                value: "https://creativecommons.org/licenses/by-sa/4.0/",
              },
            },
            thumburl: "https://thumb.wikimedia.org/example.jpg",
          },
        ],
        title: "File:Mountain.jpg",
      },
    },
  },
};

describe("Wikimedia Commons backgrounds", () => {
  beforeEach(setupTestEnvironment);
  afterEach(cleanupTestEnvironment);

  it("decodes and preserves attribution for eligible photos", () => {
    const decoded = Schema.decodeUnknownSync(CommonsResponseSchema)(
      commonsPayload
    );

    expect(parseBackgroundResponse(decoded)).toStrictEqual([
      {
        artist: "Photographer & co",
        imageUrl: "https://thumb.wikimedia.org/example.jpg",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        pageUrl: "https://commons.wikimedia.org/wiki/File:Mountain.jpg",
        title: "Mountain.jpg",
      },
    ]);
  });

  it("rejects malformed metadata and rotates deterministically", () => {
    expect(
      Either.isLeft(Schema.decodeUnknownEither(CommonsResponseSchema)({}))
    ).toBeTruthy();

    const photos = parseBackgroundResponse(
      Schema.decodeUnknownSync(CommonsResponseSchema)(commonsPayload)
    );

    expect(chooseDailyBackground(photos, 0, 0)?.title).toBe("Mountain.jpg");
    expect(chooseDailyBackground([], 0, 0)).toBeNull();
    expect(chooseDailyBackground([...photos, ...photos], 0, -1)).toBeNull();
  });

  it("filters unsafe URLs and missing attribution while decoding artist text", () => {
    const payload = {
      query: {
        pages: {
          malformed: {
            imageinfo: [],
            title: "File:Malformed.jpg",
          },
          missing: {
            imageinfo: [
              {
                descriptionurl: "https://commons.wikimedia.org/wiki/Missing",
                extmetadata: {},
                thumburl: "https://thumb.wikimedia.org/missing.jpg",
              },
            ],
            title: "File:Missing.jpg",
          },
          unsafe: {
            imageinfo: [
              {
                descriptionurl: "https://commons.wikimedia.org/wiki/Unsafe",
                extmetadata: {
                  Artist: { value: "Artist" },
                  LicenseShortName: { value: "CC" },
                  LicenseUrl: { value: "data:text/html,alert(1)" },
                },
                thumburl: `http://thumb.wikimedia.org/unsafe.jpg`,
              },
            ],
            title: "File:Unsafe.jpg",
          },
        },
      },
    };

    expect(
      parseBackgroundResponse(
        Schema.decodeUnknownSync(CommonsResponseSchema)(payload)
      )
    ).toStrictEqual([]);
  });

  it("cleans supported HTML entities and rejects invalid origins", () => {
    const payload = {
      query: {
        pages: {
          encoded: {
            imageinfo: [
              {
                descriptionurl: "https://commons.wikimedia.org/wiki/Image",
                extmetadata: {
                  Artist: {
                    value:
                      "A &quot;B&quot; &#039;C&#039; &apos;D&apos; &lt;E&gt; &amp; F",
                  },
                  LicenseShortName: { value: "CC" },
                  LicenseUrl: { value: "https://creativecommons.org/license" },
                },
                thumburl: "https://thumb.wikimedia.org/image.jpg",
              },
            ],
            title: "Landscape.jpg",
          },
          malformedUrl: {
            imageinfo: [
              {
                descriptionurl: "https://commons.wikimedia.org/wiki/Invalid",
                extmetadata: {
                  Artist: { value: "Artist" },
                  LicenseShortName: { value: "CC" },
                  LicenseUrl: { value: "https://creativecommons.org/license" },
                },
                thumburl: "not a valid URL",
              },
            ],
            title: "File:Malformed-url.jpg",
          },
          wrongHost: {
            imageinfo: [
              {
                descriptionurl: "https://commons.wikimedia.org/wiki/Wrong",
                extmetadata: {
                  Artist: { value: "Artist" },
                  LicenseShortName: { value: "CC" },
                  LicenseUrl: { value: "https://creativecommons.org/license" },
                },
                thumburl: "https://example.com/image.jpg",
              },
            ],
            title: "File:Wrong.jpg",
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

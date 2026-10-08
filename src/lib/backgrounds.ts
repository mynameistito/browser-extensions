import { Schema } from "effect";

/** A landscape image with enough provenance for visible attribution. */
export interface BackgroundPhoto {
  readonly title: string;
  readonly imageUrl: string;
  readonly pageUrl: string;
  readonly artist: string;
  readonly license: string;
  readonly licenseUrl: string;
}

const MetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Struct({ value: Schema.String }),
});

const ImageInfoSchema = Schema.Struct({
  thumburl: Schema.String,
  descriptionurl: Schema.String,
  extmetadata: MetadataSchema,
});

export const CommonsResponseSchema = Schema.Struct({
  query: Schema.Struct({
    pages: Schema.Record({
      key: Schema.String,
      value: Schema.Struct({
        title: Schema.String,
        imageinfo: Schema.Array(ImageInfoSchema),
      }),
    }),
  }),
});

const isHttpsUrl = (value: string, hostname?: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (hostname === undefined || url.hostname === hostname)
    );
  } catch {
    return false;
  }
};

const textFromHtml = (value: string): string =>
  value
    .replaceAll(/<[^<>]*>/gu, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll(/\s+/gu, " ")
    .trim();

const toPhoto = (
  title: string,
  info: Schema.Schema.Type<typeof ImageInfoSchema>
): BackgroundPhoto | null => {
  const artist = info.extmetadata.Artist?.value;
  const license = info.extmetadata.LicenseShortName?.value;
  const licenseUrl = info.extmetadata.LicenseUrl?.value;

  if (!artist || !license || !licenseUrl) {
    return null;
  }

  if (
    !isHttpsUrl(info.thumburl, "thumb.wikimedia.org") ||
    !isHttpsUrl(info.descriptionurl, "commons.wikimedia.org") ||
    !isHttpsUrl(licenseUrl)
  ) {
    return null;
  }

  return {
    title: title.replace(/^File:/u, ""),
    imageUrl: info.thumburl,
    pageUrl: info.descriptionurl,
    artist: textFromHtml(artist),
    license,
    licenseUrl,
  };
};

/** Convert a decoded Commons response into attributable landscape photos. */
export const parseBackgroundResponse = (
  input: Schema.Schema.Type<typeof CommonsResponseSchema>
): readonly BackgroundPhoto[] => {
  const photos = Object.values(input.query.pages).flatMap((page) => {
    const [info] = page.imageinfo;
    const photo = info ? toPhoto(page.title, info) : null;
    return photo ? [photo] : [];
  });

  return photos;
};

/** Pick one cached background consistently for the current day and user nonce. */
export const chooseDailyBackground = (
  photos: readonly BackgroundPhoto[],
  now: number,
  nonce: number
): BackgroundPhoto | null => {
  if (photos.length === 0) {
    return null;
  }

  const day = Math.floor(now / (24 * 60 * 60 * 1000));
  return photos[(day + nonce) % photos.length] ?? null;
};

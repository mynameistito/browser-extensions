import {
  Array as SchemaArray,
  Boolean as SchemaBoolean,
  decodeUnknownSync,
  String as SchemaString,
  Struct,
} from "effect/Schema";

const GitHubRelease = Struct({
  assets: SchemaArray(Struct({ name: SchemaString })),
  draft: SchemaBoolean,
  prerelease: SchemaBoolean,
  tag_name: SchemaString,
});

const GitHubReleases = SchemaArray(GitHubRelease);

type Browser = "chrome" | "firefox";

type Release = typeof GitHubRelease.Type;

/** Fetches one GitHub release page with Cloudflare caching options. */
export type ReleaseFetch = (
  input: URL,
  init: RequestInit & {
    cf: { cacheEverything: boolean; cacheTtl: number };
  }
) => Promise<Response>;

/** Describes whether a release and its browser asset were resolved. */
export type ReleaseResolution =
  | {
      readonly kind: "found";
      readonly release: Release;
      readonly asset: string;
    }
  | { readonly kind: "missing" }
  | { readonly kind: "error"; readonly response: Response };

const errorResponse = (message: string): Response =>
  Response.json(
    { error: message },
    { headers: { "Cache-Control": "no-store" }, status: 502 }
  );

const requestReleasesPage = async (
  page: number,
  fetcher: ReleaseFetch
): Promise<Response> => {
  const releasesUrl = new URL(
    "https://api.github.com/repos/mynameistito/browser-extensions/releases"
  );

  releasesUrl.searchParams.set("page", String(page));
  releasesUrl.searchParams.set("per_page", "100");

  return await fetcher(releasesUrl, {
    cf: { cacheEverything: true, cacheTtl: 300 },
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "browser-extensions-docs",
    },
  });
};

const findRelease = async (
  extension: string,
  browser: Browser,
  page: number,
  fetcher: ReleaseFetch
): Promise<Release | undefined | Response> => {
  const releasesResponse = await requestReleasesPage(page, fetcher);

  if (!releasesResponse.ok) {
    return errorResponse("Unable to look up the latest extension release.");
  }

  const releases: unknown = await releasesResponse.json();
  let parsedReleases: typeof GitHubReleases.Type;

  try {
    parsedReleases = decodeUnknownSync(GitHubReleases)(releases);
  } catch {
    return errorResponse("GitHub returned an invalid release list.");
  }

  const prefix = `${extension}-v`;

  const release = parsedReleases.find(
    (item) =>
      !item.draft &&
      !item.prerelease &&
      item.tag_name.startsWith(prefix) &&
      item.assets.some(
        (asset) =>
          asset.name ===
          `${extension}-${item.tag_name.slice(prefix.length)}-${browser}.zip`
      )
  );

  if (release || parsedReleases.length < 100) {
    return release;
  }

  return await findRelease(extension, browser, page + 1, fetcher);
};

const isResponse = (value: Release | undefined | Response): value is Response =>
  value instanceof Response;

/**
 * Finds the newest published release with the requested browser archive.
 *
 * @param extension - The extension's package identifier.
 * @param browser - The browser archive to resolve.
 * @param fetcher - The HTTP seam used to request GitHub release pages.
 * @returns The matching release and asset, a missing result, or an error response.
 */
export const resolveLatestRelease = async (
  extension: string,
  browser: Browser,
  fetcher: ReleaseFetch = fetch
): Promise<ReleaseResolution> => {
  const lookup = await findRelease(extension, browser, 1, fetcher);

  if (isResponse(lookup)) {
    return { kind: "error", response: lookup };
  }

  if (!lookup) {
    return { kind: "missing" };
  }

  const prefix = `${extension}-v`;
  const version = lookup.tag_name.slice(prefix.length);

  return {
    asset: `${extension}-${version}-${browser}.zip`,
    kind: "found",
    release: lookup,
  };
};

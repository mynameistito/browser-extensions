import {
  Array as SchemaArray,
  Boolean as SchemaBoolean,
  decodeUnknownSync,
  String as SchemaString,
  Struct,
} from "effect/Schema";

interface Environment {
  readonly ASSETS: Fetcher;
}

const extensions = new Set([
  "better-history",
  "github-settings-repo-copy",
  "hide-email-ext",
  "hide-ip-ext",
  "ig-video-controls",
  "mute-tab-manager",
  "new-tab-ext",
  "quote-viewer",
]);

type Browser = "chrome" | "firefox";

const isExtension = (value: string | undefined): value is string =>
  value !== undefined && extensions.has(value);

const isBrowser = (value: string | undefined): value is Browser =>
  value === "chrome" || value === "firefox";

const GitHubRelease = Struct({
  assets: SchemaArray(Struct({ name: SchemaString })),
  draft: SchemaBoolean,
  prerelease: SchemaBoolean,
  tag_name: SchemaString,
});

const GitHubReleases = SchemaArray(GitHubRelease);

const findLatestRelease = async (
  extension: string,
  browser: Browser,
  page: number
): Promise<typeof GitHubRelease.Type | Response | undefined> => {
  const prefix = `${extension}-v`;

  const releasesUrl = new URL(
    "https://api.github.com/repos/mynameistito/browser-extensions/releases"
  );

  releasesUrl.searchParams.set("page", String(page));
  releasesUrl.searchParams.set("per_page", "100");

  const releasesResponse = await fetch(releasesUrl, {
    cf: { cacheEverything: true, cacheTtl: 300 },
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "browser-extensions-docs",
    },
  });

  if (!releasesResponse.ok) {
    return Response.json(
      { error: "Unable to look up the latest extension release." },
      { headers: { "Cache-Control": "no-store" }, status: 502 }
    );
  }

  const releases: unknown = await releasesResponse.json();
  let parsedReleases: typeof GitHubReleases.Type;

  try {
    parsedReleases = decodeUnknownSync(GitHubReleases)(releases);
  } catch {
    return Response.json(
      { error: "GitHub returned an invalid release list." },
      { headers: { "Cache-Control": "no-store" }, status: 502 }
    );
  }

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

  return await findLatestRelease(extension, browser, page + 1);
};

const latestDownload = async (
  extension: string,
  browser: Browser
): Promise<Response> => {
  const lookup = await findLatestRelease(extension, browser, 1);

  if (lookup instanceof Response) {
    return lookup;
  }

  const release = lookup;

  if (!release) {
    return Response.json(
      { error: `No ${browser} release is available for ${extension}.` },
      { headers: { "Cache-Control": "no-store" }, status: 404 }
    );
  }

  const version = release.tag_name.slice(`${extension}-v`.length);
  const asset = `${extension}-${version}-${browser}.zip`;
  const target = `https://github.com/mynameistito/browser-extensions/releases/download/${encodeURIComponent(release.tag_name)}/${encodeURIComponent(asset)}`;

  return new Response(null, {
    headers: {
      "Cache-Control": "public, max-age=300",
      Location: target,
    },
    status: 302,
  });
};

export default {
  fetch(
    request: Request,
    environment: Environment
  ): Response | Promise<Response> {
    const url = new URL(request.url);

    const installMatch =
      /^\/install\/(?<extension>[^/]+)\/(?<browser>chrome|firefox)$/u.exec(
        url.pathname
      );

    if (installMatch) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return Response.json(
          { error: "Method not allowed" },
          {
            headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" },
            status: 405,
          }
        );
      }

      const { extension, browser } = installMatch.groups ?? {};

      if (!isExtension(extension) || !isBrowser(browser)) {
        return Response.json(
          { error: "Unknown extension." },
          { headers: { "Cache-Control": "no-store" }, status: 404 }
        );
      }

      return latestDownload(extension, browser);
    }

    if (url.pathname === "/api/v1/ip") {
      if (request.method !== "GET") {
        return Response.json(
          { error: "Method not allowed" },
          {
            headers: { Allow: "GET", "Cache-Control": "no-store" },
            status: 405,
          }
        );
      }

      const ip = request.headers.get("cf-connecting-ip");

      if (ip === null || ip.length === 0) {
        return Response.json(
          { error: "Client IP unavailable" },
          { headers: { "Cache-Control": "no-store" }, status: 503 }
        );
      }

      return Response.json(
        { ip },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    return environment.ASSETS.fetch(request);
  },
};

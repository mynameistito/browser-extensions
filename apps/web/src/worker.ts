import { resolveLatestRelease } from "./release-resolver";

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

const latestDownload = async (
  extension: string,
  browser: Browser
): Promise<Response> => {
  const lookup = await resolveLatestRelease(extension, browser);

  if (lookup.kind === "error") {
    return lookup.response;
  }

  if (lookup.kind === "missing") {
    return Response.json(
      { error: `No ${browser} release is available for ${extension}.` },
      { headers: { "Cache-Control": "no-store" }, status: 404 }
    );
  }

  const target = `https://github.com/mynameistito/browser-extensions/releases/download/${encodeURIComponent(lookup.release.tag_name)}/${encodeURIComponent(lookup.asset)}`;

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

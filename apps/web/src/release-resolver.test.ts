import { describe, expect, it, vi } from "vitest";

import { resolveLatestRelease } from "./release-resolver";
import type { ReleaseFetch } from "./release-resolver";

const release = (tagName: string, assetName: string) => ({
  assets: [{ name: assetName }],
  draft: false,
  prerelease: false,
  tag_name: tagName,
});

describe("extension release lookup", () => {
  it("looks through full pages and selects the matching browser asset", async () => {
    const pageOne = Array.from({ length: 100 }, (_, index) =>
      release(
        `another-extension-v${index}`,
        `another-extension-${index}-chrome.zip`
      )
    );

    const fetcher = vi
      .fn<ReleaseFetch>()
      .mockResolvedValueOnce(Response.json(pageOne))
      .mockResolvedValueOnce(
        Response.json([
          release("hide-ip-ext-v2.0.0", "hide-ip-ext-2.0.0-firefox.zip"),
          release("hide-ip-ext-v1.9.0", "hide-ip-ext-1.9.0-chrome.zip"),
        ])
      );

    const result = await resolveLatestRelease("hide-ip-ext", "chrome", fetcher);

    expect(result).toMatchObject({
      asset: "hide-ip-ext-1.9.0-chrome.zip",
      kind: "found",
      release: { tag_name: "hide-ip-ext-v1.9.0" },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      fetcher.mock.calls.map(([url]) => url.searchParams.get("page"))
    ).toStrictEqual(["1", "2"]);
    expect(fetcher.mock.calls[0]?.[0].searchParams.get("per_page")).toBe("100");
  });

  it("skips drafts, prereleases, and releases without the exact asset", async () => {
    const fetcher = vi.fn<ReleaseFetch>().mockResolvedValue(
      Response.json([
        {
          ...release("quote-viewer-v4.0.0", "quote-viewer-4.0.0-chrome.zip"),
          draft: true,
        },
        {
          ...release("quote-viewer-v3.0.0", "quote-viewer-3.0.0-chrome.zip"),
          prerelease: true,
        },
        release("quote-viewer-v2.0.0", "quote-viewer-2.0.0-firefox.zip"),
      ])
    );

    await expect(
      resolveLatestRelease("quote-viewer", "chrome", fetcher)
    ).resolves.toStrictEqual({ kind: "missing" });
  });

  it("returns a gateway error when GitHub fails or returns an invalid release list", async () => {
    const failedLookup = await resolveLatestRelease(
      "hide-ip-ext",
      "firefox",
      vi
        .fn<ReleaseFetch>()
        .mockResolvedValue(new Response(null, { status: 503 }))
    );

    const invalidLookup = await resolveLatestRelease(
      "hide-ip-ext",
      "firefox",
      vi
        .fn<ReleaseFetch>()
        .mockResolvedValue(Response.json([{ tag_name: "invalid" }]))
    );

    expect(failedLookup.kind).toBe("error");
    expect(invalidLookup.kind).toBe("error");

    if (failedLookup.kind !== "error" || invalidLookup.kind !== "error") {
      throw new Error(
        "Expected GitHub lookup failures to return gateway errors."
      );
    }

    expect(failedLookup.response.status).toBe(502);
    await expect(failedLookup.response.json()).resolves.toStrictEqual({
      error: "Unable to look up the latest extension release.",
    });
    await expect(invalidLookup.response.json()).resolves.toStrictEqual({
      error: "GitHub returned an invalid release list.",
    });
  });
});

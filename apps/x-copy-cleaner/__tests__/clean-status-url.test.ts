import { describe, expect, it, vi } from "vitest";

import {
  cleanStatusAddressBarUrl,
  cleanStatusUrl,
} from "../src/lib/clean-status-url";

describe(cleanStatusUrl, () => {
  it("removes tracking parameters from X status links", () => {
    expect(
      cleanStatusUrl(
        "https://x.com/leviackermanft/status/2115692550774526328?a=tracking&s=19"
      )
    ).toBe("https://x.com/leviackermanft/status/2115692550774526328");
  });

  it("supports Twitter links and keeps the original host and path", () => {
    expect(
      cleanStatusUrl("https://twitter.com/name/status/123?s=20#reply")
    ).toBe("https://twitter.com/name/status/123#reply");
  });

  it("leaves links without a query string untouched", () => {
    const url = "https://x.com/name/status/123";

    expect(cleanStatusUrl(url)).toBe(url);
  });

  it("does not alter non-status URLs or unrelated text", () => {
    const text = "https://x.com/name?utm_source=share";

    expect(cleanStatusUrl(text)).toBe(text);
    expect(cleanStatusUrl("check this out")).toBe("check this out");
  });

  it("does not alter lookalike domains", () => {
    const url = "https://notx.com/name/status/123?source=share";

    expect(cleanStatusUrl(url)).toBe(url);
  });
});

describe(cleanStatusAddressBarUrl, () => {
  it("replaces a tracked status URL without reloading the page", () => {
    const replaceState = vi.fn<History["replaceState"]>();

    const history = {
      replaceState,
      state: { page: "post" },
    };

    cleanStatusAddressBarUrl(
      history,
      "https://x.com/name/status/123?a=tracking&s=20"
    );

    expect(replaceState).toHaveBeenCalledWith(
      history.state,
      "",
      "https://x.com/name/status/123"
    );
  });

  it("leaves an already-clean address alone", () => {
    const replaceState = vi.fn<History["replaceState"]>();

    const history = { replaceState, state: null };

    cleanStatusAddressBarUrl(history, "https://x.com/name/status/123");

    expect(replaceState).not.toHaveBeenCalled();
  });
});

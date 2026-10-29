import { describe, expect, it, vi } from "vitest";

import { patchClipboardWriter } from "../src/lib/clean-status-url";

describe(patchClipboardWriter, () => {
  it("cleans a tracked post link before calling the native clipboard writer", async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockResolvedValue();

    const clipboard = { writeText };

    patchClipboardWriter(clipboard);
    await clipboard.writeText("https://x.com/name/status/123?a=tracking&s=19");

    expect(writeText).toHaveBeenCalledWith("https://x.com/name/status/123");
  });

  it("passes non-status clipboard text through unchanged", async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockResolvedValue();

    const clipboard = { writeText };

    patchClipboardWriter(clipboard);
    await clipboard.writeText("A note for later");

    expect(writeText).toHaveBeenCalledWith("A note for later");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockCalls,
  mockEvents,
  resetChromeMock,
  restoreListeners,
  snapshotListeners,
} from "@/tests/helpers/chrome-mock.ts";

describe("offscreen dark-mode reporter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    resetChromeMock();
    restoreListeners(
      new Map([...snapshotListeners()].map(([event]) => [event, []]))
    );
  });

  it("reports the initial preference, changes, and explicit requests", async () => {
    const changes = new EventTarget();

    const addEventListener = vi.fn<
      (type: string, listener: EventListenerOrEventListenerObject) => void
    >((type, listener) => {
      changes.addEventListener(type, listener);
    });

    vi.stubGlobal("window", {
      matchMedia: () => ({
        addEventListener,
        matches: true,
      }),
    });

    await import("@/entrypoints/offscreen/main.ts");
    await Promise.resolve();

    expect(mockCalls.runtime.sendMessage).toContainEqual({
      isDark: true,
      type: "DARK_MODE_RESPONSE",
    });

    changes.dispatchEvent(
      Object.assign(new Event("change"), { matches: false })
    );
    await mockEvents.runtime.onMessage.fire(
      { type: "GET_DARK_MODE" },
      {},
      () => {}
    );
    await mockEvents.runtime.onMessage.fire(
      { type: "UNRELATED" },
      {},
      () => {}
    );
    await Promise.resolve();

    expect(mockCalls.runtime.sendMessage).toHaveLength(3);
    expect(mockCalls.runtime.sendMessage[1]).toStrictEqual({
      isDark: false,
      type: "DARK_MODE_RESPONSE",
    });
    expect(mockCalls.runtime.sendMessage[2]).toStrictEqual({
      isDark: true,
      type: "DARK_MODE_RESPONSE",
    });
  });

  it("ignores a failed response when the background is unavailable", async () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({
        addEventListener: vi.fn<MediaQueryList["addEventListener"]>(),
        matches: false,
      }),
    });
    vi.spyOn(chrome.runtime, "sendMessage").mockRejectedValueOnce(
      new Error("background unavailable")
    );

    await expect(
      import("@/entrypoints/offscreen/main.ts")
    ).resolves.toBeDefined();
    await Promise.resolve();

    expect(mockCalls.runtime.sendMessage).toHaveLength(0);
  });
});

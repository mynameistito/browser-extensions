import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* oxlint-disable vitest/max-expects, vitest/require-top-level-describe, promise/prefer-await-to-callbacks, eslint/require-await, promise/avoid-new, eslint/no-promise-executor-return, vitest/prefer-to-be-falsy, vitest/prefer-to-be-truthy, vitest/require-mock-type-parameters, anti-slop/no-unknown-parameters, github/no-inner-html, typescript/return-await, typescript/strict-void-return */

interface ContentOptions {
  matches: string[];
  main: () => void;
  runAt: string;
}

type MessageListener = (
  message: { type?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: string | null) => void
) => boolean;

const setupContentScript = async (response: unknown): Promise<void> => {
  vi.stubGlobal("browser", {
    runtime: { sendMessage: vi.fn().mockResolvedValue(response) },
  });
  vi.stubGlobal("defineContentScript", (options: ContentOptions) => {
    options.main();

    return options;
  });
  await import("../entrypoints/ip-veil.content");
  await Promise.resolve();
};

const setupBackground = async (): Promise<MessageListener> => {
  let listener: MessageListener | undefined;
  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: {
        addListener: (callback: MessageListener) => {
          listener = callback;
        },
      },
    },
  });
  vi.stubGlobal("defineBackground", (callback: () => void) => {
    callback();
  });
  await import("../entrypoints/background");

  if (!listener) {
    throw new Error("Background message listener was not registered");
  }

  return listener;
};

const sendMessage = async (
  listener: MessageListener,
  type: string
): Promise<string | null> =>
  await new Promise((resolve) => {
    const keepChannelOpen = listener({ type }, {}, resolve);

    if (!keepChannelOpen) {
      resolve(null);
    }
  });

let testWindow: Window;

beforeEach(() => {
  vi.resetModules();
  testWindow = new Window();
  vi.stubGlobal("window", testWindow);
  vi.stubGlobal("document", testWindow.document);
  vi.stubGlobal("Node", testWindow.Node);
  vi.stubGlobal("Text", testWindow.Text);
  vi.stubGlobal("Element", testWindow.Element);
  vi.stubGlobal("NodeFilter", testWindow.NodeFilter);
  vi.stubGlobal("MutationObserver", testWindow.MutationObserver);
  vi.stubGlobal("console", { ...console, error: vi.fn() });
});

afterEach(() => {
  testWindow.close();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("background IP lookup", () => {
  it("returns and caches a valid IP, and ignores other messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ip: "203.0.113.4" }),
      ok: true,
    });

    vi.stubGlobal("fetch", fetchMock);
    const listener = await setupBackground();

    expect(listener({ type: "OTHER" }, {}, vi.fn())).toBe(false);
    await expect(sendMessage(listener, "IP_VEIL_GET_IP")).resolves.toBe(
      "203.0.113.4"
    );
    await expect(sendMessage(listener, "IP_VEIL_GET_IP")).resolves.toBe(
      "203.0.113.4"
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refreshes the cached address after fifteen minutes", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ ip: "203.0.113.4" }),
        ok: true,
      })
      .mockResolvedValueOnce({
        json: async () => ({ ip: "203.0.113.5" }),
        ok: true,
      });

    vi.stubGlobal("fetch", fetchMock);
    const listener = await setupBackground();

    await expect(sendMessage(listener, "IP_VEIL_GET_IP")).resolves.toBe(
      "203.0.113.4"
    );
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    await expect(sendMessage(listener, "IP_VEIL_GET_IP")).resolves.toBe(
      "203.0.113.5"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([null, "not an object", {}, { ip: 42 }])(
    "returns null for an invalid API payload: %s",
    async (payload) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => payload,
          ok: true,
        })
      );
      const listener = await setupBackground();

      await expect(sendMessage(listener, "IP_VEIL_GET_IP")).resolves.toBeNull();
    }
  );

  it("responds with null and logs when the API rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const listener = await setupBackground();

    await expect(sendMessage(listener, "IP_VEIL_GET_IP")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "Unable to look up your public IP address."
    );
  });
});

describe("content IP veiling", () => {
  it("blurs exact matches, excludes form/script content, and reveals on pointer", async () => {
    document.body.innerHTML = `<p>IP: 203.0.113.4; again 203.0.113.4</p>
      <textarea>203.0.113.4</textarea><input value="203.0.113.4">
      <script>203.0.113.4</script><p>203.0.113.40</p>`;
    await setupContentScript("203.0.113.4");

    const veils = document.querySelectorAll<HTMLElement>(".ip-veil-hidden");
    expect(veils).toHaveLength(2);
    expect(document.querySelector("style#ip-veil-styles")).not.toBeNull();
    expect(veils[0]?.dataset.ip).toBe("203.0.113.4");
    expect(veils[0]?.getAttribute("aria-label")).toContain("blurred");
    veils[0]?.dispatchEvent(new Event("pointerenter"));
    expect(veils[0]?.classList.contains("ip-veil-visible")).toBe(true);
    expect(veils[0]?.getAttribute("aria-label")).toContain("visible");
    veils[0]?.dispatchEvent(new Event("pointerleave"));
    expect(veils[0]?.classList.contains("ip-veil-visible")).toBe(false);
    expect(document.querySelector("textarea")?.textContent).toBe("203.0.113.4");
    expect(document.querySelector("input")?.getAttribute("value")).toBe(
      "203.0.113.4"
    );
  });

  it("redacts document and element titles, including later changes and additions", async () => {
    document.body.innerHTML = '<p title="203.0.113.4">203.0.113.4</p>';
    document.title = "IP 203.0.113.4";
    await setupContentScript("203.0.113.4");
    expect(document.title).toBe("IP your-ip");
    expect(document.querySelector("p")?.getAttribute("title")).toBe("your-ip");

    const p = document.querySelector("p");
    p?.setAttribute("title", "Current IP: 203.0.113.4");
    const added = document.createElement("section");
    added.title = "203.0.113.4";
    added.textContent = "203.0.113.4";
    const nested = document.createElement("span");
    nested.title = "Nested: 203.0.113.4";
    added.append(nested);
    added.append(document.createComment("No text to veil"));
    document.body.append(added);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(p?.getAttribute("title")).toBe("Current IP: your-ip");
    expect(added.title).toBe("your-ip");
    expect(nested.title).toBe("Nested: your-ip");
    expect(added.querySelector(".ip-veil-hidden")).not.toBeNull();
    vi.resetModules();
    await setupContentScript("203.0.113.4");
  });

  it.each([null, "", 42])(
    "does nothing for an unavailable IP (%s)",
    async (response) => {
      document.body.textContent = "203.0.113.4";
      await setupContentScript(response);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(document.querySelector("style")).toBeNull();
      expect(document.body.textContent).toBe("203.0.113.4");
    }
  );

  it("fails open if the runtime message rejects", async () => {
    vi.stubGlobal("browser", {
      runtime: { sendMessage: vi.fn().mockRejectedValue(new Error("offline")) },
    });
    vi.stubGlobal("defineContentScript", (options: ContentOptions) => {
      options.main();

      return options;
    });
    await import("../entrypoints/ip-veil.content");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector("style")).toBeNull();
  });

  it("does not process text in an otherwise empty document body", async () => {
    document.body.replaceChildren(document.createElement("textarea"));
    await setupContentScript("203.0.113.4");

    expect(document.querySelector(".ip-veil-hidden")).toBeNull();
  });
});

import { describe, expect, it, afterEach, vi } from "vitest";

import { createRedactor } from "../src/lib/redact";
import {
  flush,
  sleep,
  setMarkup,
  email,
  resetRedactorDocument,
} from "./redact-test-helpers";

describe("redaction tooltip behavior", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    resetRedactorDocument();
  });

  it("shows a reveal tooltip on hover and focus", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    const toggle = document.body.querySelector<HTMLElement>('[role="button"]');

    const tooltip =
      toggle?.parentElement?.querySelector<HTMLElement>('[role="tooltip"]');

    expect({
      description: toggle?.getAttribute("aria-description"),
      display: tooltip?.style.display,
      padding: tooltip?.style.padding,
      text: tooltip?.textContent,
    }).toStrictEqual({
      description: "Click to reveal email",
      display: "none",
      padding: "2px 6px",
      text: "Click to reveal email",
    });

    toggle?.dispatchEvent(new Event("focus"));
    const focusedDisplay = tooltip?.style.display;

    toggle?.dispatchEvent(new Event("mouseenter"));
    toggle?.dispatchEvent(new Event("blur"));
    expect([focusedDisplay, tooltip?.style.display]).toStrictEqual([
      "block",
      "none",
    ]);

    toggle?.dispatchEvent(new Event("mouseenter"));
    expect(tooltip?.style.display).toBe("none");

    await sleep(550);

    expect(tooltip?.style.display).toBe("block");

    toggle?.dispatchEvent(
      new Event("click", { bubbles: true, cancelable: true })
    );

    expect({
      description: toggle?.getAttribute("aria-description"),
      text: tooltip?.textContent,
    }).toStrictEqual({
      description: "Click to hide email",
      text: "Click to hide email",
    });

    toggle?.dispatchEvent(new Event("mouseleave"));
  });

  it("hides tooltips when hover ends or focus leaves without a hover", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const toggle = document.body.querySelector<HTMLElement>('[role="button"]');

    const tooltip =
      document.body.querySelector<HTMLElement>('[role="tooltip"]');

    toggle?.dispatchEvent(new Event("focus"));
    expect(tooltip?.style.display).toBe("block");
    toggle?.dispatchEvent(new Event("blur"));
    expect(tooltip?.style.display).toBe("none");

    toggle?.dispatchEvent(new Event("mouseenter"));
    toggle?.dispatchEvent(new Event("mouseleave"));
    await sleep(525);
    expect(tooltip?.style.display).toBe("none");

    toggle?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(toggle?.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps a focused tooltip visible while hover changes and reschedules on blur", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const toggle = document.body.querySelector<HTMLElement>('[role="button"]');

    const tooltip =
      document.body.querySelector<HTMLElement>('[role="tooltip"]');

    toggle?.dispatchEvent(new Event("mouseenter"));
    toggle?.dispatchEvent(new Event("focus"));
    toggle?.dispatchEvent(new Event("mouseleave"));
    expect(tooltip?.style.display).toBe("block");

    toggle?.dispatchEvent(new Event("mouseenter"));
    toggle?.dispatchEvent(new Event("blur"));
    expect(tooltip?.style.display).toBe("none");
    await sleep(550);
    expect(tooltip?.style.display).toBe("block");
  });

  it("does not show the hover tooltip when focus is gained before its delay", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const toggle = document.body.querySelector<HTMLElement>('[role="button"]');

    const tooltip =
      document.body.querySelector<HTMLElement>('[role="tooltip"]');

    toggle?.dispatchEvent(new Event("mouseenter"));
    toggle?.dispatchEvent(new Event("focus"));
    await sleep(525);

    expect(tooltip?.style.display).toBe("block");
    expect(tooltip?.getAttribute("aria-hidden")).toBe("false");
  });

  it("keeps a focused tooltip visible if a cancelled hover callback races", async () => {
    vi.useFakeTimers();
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await vi.advanceTimersByTimeAsync(200);

    const toggle = document.querySelector<HTMLElement>('[role="button"]');
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]');

    if (!toggle || !tooltip) {
      throw new TypeError("Expected a redaction toggle and tooltip");
    }

    const clearTimeoutSpy = vi
      .spyOn(globalThis, "clearTimeout")
      .mockImplementation(() => {});

    try {
      toggle.dispatchEvent(new Event("mouseenter"));
      toggle.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(500);

      expect(tooltip.style.display).toBe("block");
    } finally {
      clearTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

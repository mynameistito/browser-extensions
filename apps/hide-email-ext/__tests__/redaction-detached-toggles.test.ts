import { describe, expect, it, afterEach } from "vitest";

import { createRedactor } from "../src/lib/redact";
import {
  flush,
  sleep,
  setMarkup,
  DECOY_EMAIL_PATTERN,
  email,
  resetRedactorDocument,
} from "./redact-test-helpers";

describe("detached redaction toggles", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    resetRedactorDocument();
  });

  it("keeps removed redaction toggles operable if their subtree is reinserted", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const paragraph = document.body.querySelector("p");
    const toggle = paragraph?.querySelector<HTMLElement>('[role="button"]');
    const tooltip = paragraph?.querySelector<HTMLElement>('[role="tooltip"]');

    toggle?.dispatchEvent(new Event("mouseenter"));
    paragraph?.remove();
    await flush();
    await sleep(550);

    expect(tooltip?.style.display).toBe("none");

    if (paragraph) {
      document.body.append(paragraph);
    }

    await flush();

    const reinsertedToggle =
      paragraph?.querySelector<HTMLElement>('[role="button"]');

    const click = new Event("click", { bubbles: true, cancelable: true });
    reinsertedToggle?.dispatchEvent(click);

    expect(click.defaultPrevented).toBeTruthy();
    expect(reinsertedToggle?.getAttribute("aria-pressed")).toBe("true");

    redactor.setEmails([]);
    expect(document.body.querySelector("p")?.textContent).toBe(email);
  });

  it("keeps an individually detached toggle operable and restorable", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const paragraph = document.body.querySelector("p");

    const wrapper = paragraph?.querySelector<HTMLElement>(
      '[data-redacted="toggle-container"]'
    );

    wrapper?.remove();
    await flush();
    redactor.setEmails([email, "admin@other.io"]);

    expect(wrapper?.textContent).not.toContain(email);

    if (wrapper) {
      paragraph?.append(wrapper);
    }

    await flush();

    const toggle = wrapper?.querySelector<HTMLElement>('[role="button"]');
    const click = new Event("click", { bubbles: true, cancelable: true });
    toggle?.dispatchEvent(click);

    expect(click.defaultPrevented).toBeTruthy();
    expect(toggle?.getAttribute("aria-pressed")).toBe("true");

    redactor.setEmails([]);
    expect(paragraph?.textContent).toBe(email);
  });

  it("reattaches the same-pattern detached wrapper without replacing its toggle", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const paragraph = document.body.querySelector("p");

    const wrapper = paragraph?.querySelector<HTMLElement>(
      '[data-redacted="toggle-container"]'
    );

    const toggle = wrapper?.querySelector<HTMLElement>('[role="button"]');

    wrapper?.remove();
    await flush();

    if (wrapper) {
      paragraph?.append(wrapper);
    }

    await flush();

    expect(wrapper?.querySelector('[role="button"]')).toBe(toggle);
    expect(toggle?.textContent).toMatch(DECOY_EMAIL_PATTERN);
    redactor.setEmails([]);
    expect(paragraph?.textContent).toBe(email);
  });

  it("restores and rescans a detached toggle when its configured pattern changes", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const paragraph = document.body.querySelector("p");

    const wrapper = paragraph?.querySelector<HTMLElement>(
      '[data-redacted="toggle-container"]'
    );

    wrapper?.remove();
    await flush();
    redactor.setEmails(["other@example.net"]);

    if (wrapper) {
      paragraph?.append(wrapper);
    }

    await flush();

    expect(wrapper?.querySelector('[role="button"]')).toBeNull();
    expect(paragraph?.textContent).toBe(email);
  });
});

import { afterEach, describe, expect, test } from "bun:test";

import { createRedactor } from "../src/lib/redact";
import { REDACTION_TOKEN } from "../src/lib/types";

const flush = async (): Promise<void> => {
  await Bun.sleep(200);
};

const email = "user@example.com";

const setMarkup = (element: Element, markup: string): void => {
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  element.replaceChildren(...parsed.body.childNodes);
};

describe("redactor", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    document.body.replaceChildren();
    document.documentElement.removeAttribute("title");
    document.documentElement.removeAttribute("aria-label");
    document.documentElement.removeAttribute("alt");
    document.documentElement.removeAttribute("placeholder");
  });

  test("blurs matching email text and reveals it when activated", async () => {
    setMarkup(document.body, `<p>Contact me at ${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    const toggle = document.body.querySelector<HTMLElement>('[role="button"]');
    expect(toggle?.textContent).toBe(email);
    expect(toggle?.getAttribute("aria-label")).toBe("Toggle email visibility");
    expect(toggle?.getAttribute("aria-pressed")).toBe("false");
    expect(toggle?.style.filter).toBe("blur(4px)");

    toggle?.dispatchEvent(
      new Event("click", { bubbles: true, cancelable: true })
    );

    expect(toggle?.getAttribute("aria-pressed")).toBe("true");
    expect(toggle?.getAttribute("aria-label")).toBe(email);
    expect(toggle?.style.filter).toBe("none");

    toggle?.dispatchEvent(
      new Event("click", { bubbles: true, cancelable: true })
    );

    expect(toggle?.getAttribute("aria-pressed")).toBe("false");
    expect(toggle?.getAttribute("aria-label")).toBe("Toggle email visibility");
    expect(toggle?.style.filter).toBe("blur(4px)");
  });

  test("shows a reveal tooltip on hover and focus", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    const toggle = document.body.querySelector<HTMLElement>('[role="button"]');

    const tooltip =
      toggle?.parentElement?.querySelector<HTMLElement>('[role="tooltip"]');

    expect(toggle?.getAttribute("aria-description")).toBe(
      "Click to reveal email"
    );
    expect(tooltip?.textContent).toBe("Click to reveal email");
    expect(tooltip?.style.display).toBe("none");
    expect(tooltip?.style.padding).toBe("2px 6px");

    toggle?.dispatchEvent(new Event("focus"));

    expect(tooltip?.style.display).toBe("block");

    toggle?.dispatchEvent(new Event("blur"));
    expect(tooltip?.style.display).toBe("none");

    toggle?.dispatchEvent(new Event("mouseenter"));
    expect(tooltip?.style.display).toBe("none");

    await Bun.sleep(550);

    expect(tooltip?.style.display).toBe("block");

    toggle?.dispatchEvent(
      new Event("click", { bubbles: true, cancelable: true })
    );

    expect(tooltip?.textContent).toBe("Click to hide email");
    expect(toggle?.getAttribute("aria-description")).toBe(
      "Click to hide email"
    );

    toggle?.dispatchEvent(new Event("mouseleave"));

    expect(tooltip?.style.display).toBe("none");
  });

  test("keeps mailto links clickable while redacting their email text", async () => {
    setMarkup(document.body, `<a href="mailto:${email}">Contact ${email}</a>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    const link = document.body.querySelector("a");
    expect(link?.textContent).toBe(`Contact ${REDACTION_TOKEN}`);
    expect(link?.querySelector('[role="button"]')).toBeNull();

    let receivedClick = false;
    link?.addEventListener("click", () => {
      receivedClick = true;
    });
    const click = new Event("click", { bubbles: true, cancelable: true });
    link?.dispatchEvent(click);

    expect(receivedClick).toBe(true);
    expect(click.defaultPrevented).toBe(false);
  });

  test("keeps other links clickable while redacting their email text", async () => {
    setMarkup(document.body, `<a href="/profile">${email}</a>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    const link = document.body.querySelector("a");
    expect(link?.textContent).toBe(REDACTION_TOKEN);
    expect(link?.querySelector('[role="button"]')).toBeNull();

    let receivedClick = false;
    link?.addEventListener("click", () => {
      receivedClick = true;
    });
    const click = new Event("click", { bubbles: true, cancelable: true });
    link?.dispatchEvent(click);

    expect(receivedClick).toBe(true);
    expect(click.defaultPrevented).toBe(false);
  });

  test("does not redact inside skipped tags", async () => {
    setMarkup(
      document.body,
      `<script>var e = "${email}";</script><style>a[data="${email}"]{}</style><textarea>${email}</textarea>`
    );

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    expect(document.body.querySelector("script")?.textContent).toContain(email);
    expect(document.body.querySelector("style")?.textContent).toContain(email);
    expect(document.body.querySelector("textarea")?.textContent).toContain(
      email
    );
  });

  test("redacts email in scannable attributes", async () => {
    setMarkup(
      document.body,
      `<a title="Email ${email}" aria-label="Copy ${email}">link</a>`
    );

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    expect(document.body.querySelector("a")?.getAttribute("title")).toBe(
      `Email ${REDACTION_TOKEN}`
    );
    expect(document.body.querySelector("a")?.getAttribute("aria-label")).toBe(
      `Copy ${REDACTION_TOKEN}`
    );
  });

  test("skips elements marked with data-redacted", async () => {
    setMarkup(document.body, `<div data-redacted="true"><p>${email}</p></div>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    expect(document.body.querySelector("p")?.textContent).toContain(email);
  });

  test("does not redact when no emails are set", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.start();

    await flush();

    expect(document.body.textContent).toContain(email);
  });

  test("redacts multiple distinct emails", async () => {
    const second = "admin@other.io";

    setMarkup(document.body, `<span>${email}</span><span>${second}</span>`);

    redactor = createRedactor();
    redactor.setEmails([email, second]);
    redactor.start();

    await flush();

    const toggles = document.body.querySelectorAll('[role="button"]');
    expect(toggles[0]?.textContent).toBe(email);
    expect(toggles[1]?.textContent).toBe(second);
  });

  test("setEmails with empty array disables redaction", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([]);
    redactor.start();

    await flush();

    expect(document.body.textContent).toContain(email);
  });

  test("updates emails and rescans while running", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.start();
    await flush();

    expect(document.body.textContent).toContain(email);

    redactor.setEmails([email]);
    await flush();

    expect(document.body.querySelector('[role="button"]')?.textContent).toBe(
      email
    );
  });

  test("handles empty text nodes without error", async () => {
    setMarkup(document.body, "<p></p>");
    const p = document.body.querySelector("p");
    p?.append(document.createTextNode(""));

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();
  });

  test("handles attribute mutations on root element without parent", async () => {
    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    document.documentElement.setAttribute("title", email);
    await flush();
  });

  test("stop cancels pending idle callback", () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    redactor.setEmails([email]);
    redactor.stop();
    redactor = null;
  });

  test("stop cancels pending timeout fallback", () => {
    const ric = Object.getOwnPropertyDescriptor(window, "requestIdleCallback");
    const cic = Object.getOwnPropertyDescriptor(window, "cancelIdleCallback");
    Reflect.deleteProperty(window, "requestIdleCallback");
    Reflect.deleteProperty(window, "cancelIdleCallback");

    try {
      setMarkup(document.body, `<p>${email}</p>`);

      redactor = createRedactor();
      redactor.setEmails([email]);
      redactor.start();
      redactor.setEmails([email]);
      redactor.stop();
      redactor = null;
    } finally {
      if (ric !== undefined) {
        Object.defineProperty(window, "requestIdleCallback", ric);
      }

      if (cic !== undefined) {
        Object.defineProperty(window, "cancelIdleCallback", cic);
      }
    }
  });

  test("scans after DOMContentLoaded when document is loading", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      document,
      "readyState"
    );

    try {
      Object.defineProperty(document, "readyState", {
        configurable: true,
        value: "loading",
      });

      setMarkup(document.body, `<p>${email}</p>`);

      redactor = createRedactor();
      redactor.setEmails([email]);
      redactor.start();
      await flush();

      expect(document.body.textContent).toContain(email);

      Object.defineProperty(document, "readyState", {
        configurable: true,
        value: "complete",
      });
      document.dispatchEvent(new Event("DOMContentLoaded"));
      await flush();

      expect(document.body.querySelector('[role="button"]')?.textContent).toBe(
        email
      );
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(document, "readyState", originalDescriptor);
      } else {
        Reflect.deleteProperty(document, "readyState");
      }
    }
  });
});

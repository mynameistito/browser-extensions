import { describe, expect, it, afterEach, vi } from "vitest";

import { createRedactor } from "../src/lib/redact";
import { REDACTION_TOKEN } from "../src/lib/types";
import {
  flush,
  setMarkup,
  DECOY_EMAIL_PATTERN,
  email,
  resetRedactorDocument,
} from "./redact-test-helpers";

describe("observer lifecycle", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    resetRedactorDocument();
  });

  it("drains removed subtrees before clearing and stopping", async () => {
    setMarkup(
      document.body,
      `<section><p>${email}</p><a href="/profile" title="Contact ${email}">Contact ${email}</a></section>`
    );

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const section = document.body.querySelector("section");
    section?.remove();
    redactor.setEmails([]);
    redactor.stop();

    if (section) {
      document.body.append(section);
    }

    expect(section?.querySelector('[role="button"]')).toBeNull();
    expect(section?.querySelector("p")?.textContent).toBe(email);
    expect(section?.querySelector("a")?.textContent).toBe(`Contact ${email}`);
    expect(section?.querySelector("a")?.getAttribute("title")).toBe(
      `Contact ${email}`
    );
  });

  it("handles empty text nodes without error", async () => {
    setMarkup(document.body, "<p></p>");
    const p = document.body.querySelector("p");
    p?.append(document.createTextNode(""));

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    expect(p?.textContent).toBe("");
  });

  it("scans a document without an HTML body", () => {
    const xmlDocument = document.implementation.createDocument(
      "urn:example",
      "root",
      null
    );

    xmlDocument.documentElement.textContent = "plain text";

    redactor = createRedactor(xmlDocument);
    redactor.setEmails([email]);
    redactor.start();
    redactor.setEmails(["other@example.net"]);

    expect(xmlDocument.documentElement.textContent).toBe("plain text");
  });

  it("handles attribute mutations on root element without parent", async () => {
    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    document.documentElement.setAttribute("title", email);
    await flush();

    expect(document.documentElement.getAttribute("title")).toBe(
      REDACTION_TOKEN
    );

    redactor.setEmails([]);
    await flush();

    expect(document.documentElement.getAttribute("title")).toBe(email);
  });

  it("does not wrap title text when the email list changes", () => {
    document.title = email;
    document.documentElement.setAttribute("title", email);

    redactor = createRedactor();
    redactor.start();
    redactor.setEmails([email]);

    expect(document.title).toBe(email);
    expect(document.documentElement.getAttribute("title")).toBe(
      REDACTION_TOKEN
    );
    expect(
      document.head?.querySelector('[data-redacted="toggle-container"]')
    ).toBeNull();
  });

  it("restores attributes on non-HTML elements", async () => {
    setMarkup(document.body, "<svg></svg>");
    const svg = document.body.querySelector("svg");
    svg?.setAttribute("title", email);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    await flush();
    expect(svg?.getAttribute("title")).toBe(REDACTION_TOKEN);

    redactor.setEmails([]);
    expect(svg?.getAttribute("title")).toBe(email);
  });

  it("stop cancels pending idle callback", async () => {
    const originalRequestIdleCallback = Object.getOwnPropertyDescriptor(
      window,
      "requestIdleCallback"
    );

    const originalCancelIdleCallback = Object.getOwnPropertyDescriptor(
      window,
      "cancelIdleCallback"
    );

    const cancelIdleCallback = vi.fn<(handle: number) => void>();

    Object.defineProperties(window, {
      cancelIdleCallback: { configurable: true, value: cancelIdleCallback },
      requestIdleCallback: { configurable: true, value: () => 1 },
    });

    try {
      setMarkup(document.body, `<p>${email}</p>`);

      redactor = createRedactor();
      redactor.setEmails([email]);
      redactor.start();
      redactor.setEmails([email]);
      await Promise.resolve();
      redactor.stop();

      expect(cancelIdleCallback).toHaveBeenCalledWith(1);
      redactor = null;
    } finally {
      if (originalRequestIdleCallback) {
        Object.defineProperty(
          window,
          "requestIdleCallback",
          originalRequestIdleCallback
        );
      } else {
        Reflect.deleteProperty(window, "requestIdleCallback");
      }

      if (originalCancelIdleCallback) {
        Object.defineProperty(
          window,
          "cancelIdleCallback",
          originalCancelIdleCallback
        );
      } else {
        Reflect.deleteProperty(window, "cancelIdleCallback");
      }
    }
  });

  it("stop cancels pending timeout fallback", async () => {
    const ric = Object.getOwnPropertyDescriptor(window, "requestIdleCallback");
    const cic = Object.getOwnPropertyDescriptor(window, "cancelIdleCallback");
    const clearTimeout = vi.spyOn(globalThis, "clearTimeout");
    Reflect.deleteProperty(window, "requestIdleCallback");
    Reflect.deleteProperty(window, "cancelIdleCallback");

    try {
      setMarkup(document.body, `<p>${email}</p>`);

      redactor = createRedactor();
      redactor.setEmails([email]);
      redactor.start();
      redactor.setEmails([email]);
      await Promise.resolve();
      redactor.stop();
      expect(clearTimeout).toHaveBeenCalledWith(expect.anything());
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

  it("scans after DOMContentLoaded when document is loading", async () => {
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

      expect(
        document.body.querySelector('[role="button"]')?.textContent
      ).toMatch(DECOY_EMAIL_PATTERN);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(document, "readyState", originalDescriptor);
      } else {
        Reflect.deleteProperty(document, "readyState");
      }
    }
  });
});

import { describe, expect, it, afterEach } from "vitest";

import { createRedactor } from "../src/lib/redact";
import { REDACTION_TOKEN } from "../src/lib/types";
import {
  flush,
  setMarkup,
  DECOY_EMAIL_PATTERN,
  email,
  resetRedactorDocument,
} from "./redact-test-helpers";

describe("DOM scanning and configuration", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    resetRedactorDocument();
  });

  it("does not redact inside skipped tags", async () => {
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

  it("redacts matching text in linked content without replacing the link", async () => {
    setMarkup(document.body, `<a href="mailto:${email}">Contact ${email}</a>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const link = document.body.querySelector("a");
    expect(link?.getAttribute("href")).toBe(`mailto:${email}`);
    expect(link?.textContent).toBe(`Contact ${REDACTION_TOKEN}`);

    redactor.setEmails([]);
    expect(link?.textContent).toBe(`Contact ${email}`);
  });

  it("does not redact matching text inside editable elements", async () => {
    setMarkup(document.body, `<div contenteditable="true">${email}</div>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    expect(document.body.querySelector('[role="button"]')).toBeNull();
    expect(document.body.textContent).toBe(email);
  });

  it("keeps character-data updates inside editable content untouched", async () => {
    setMarkup(document.body, '<div contenteditable="true"><p>plain</p></div>');

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const text = document.querySelector("p")?.firstChild;

    if (!(text instanceof Text)) {
      throw new TypeError("Expected editable text content");
    }

    text.nodeValue = email;
    await flush();

    expect(document.querySelector('[role="button"]')).toBeNull();
    expect(text.nodeValue).toBe(email);
  });

  it("redacts email in scannable attributes", async () => {
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

  it("skips elements marked with data-redacted", async () => {
    setMarkup(document.body, `<div data-redacted="true"><p>${email}</p></div>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    expect(document.body.querySelector("p")?.textContent).toContain(email);
  });

  it("does not redact when no emails are set", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.start();

    await flush();

    expect(document.body.textContent).toContain(email);
  });

  it("redacts multiple distinct emails", async () => {
    const second = "admin@other.io";

    setMarkup(document.body, `<span>${email}</span><span>${second}</span>`);

    redactor = createRedactor();
    redactor.setEmails([email, second]);
    redactor.start();

    await flush();

    const toggles = document.body.querySelectorAll('[role="button"]');
    expect(toggles[0]?.textContent).toMatch(DECOY_EMAIL_PATTERN);
    expect(toggles[0]?.textContent).not.toBe(email);
    expect(toggles[1]?.textContent).toMatch(DECOY_EMAIL_PATTERN);
    expect(toggles[1]?.textContent).not.toBe(second);
  });

  it("empty email configuration stops redacting later DOM mutations", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    redactor.setEmails([]);
    const dynamicParagraph = document.createElement("p");
    dynamicParagraph.textContent = email;
    document.body.append(dynamicParagraph);
    await flush();

    expect(dynamicParagraph.querySelector('[role="button"]')).toBeNull();
    expect(dynamicParagraph.textContent).toBe(email);
  });

  it("restores a moved subtree without scanning it after clearing emails", async () => {
    setMarkup(
      document.body,
      `<section><p>${email}</p></section><aside></aside>`
    );

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();
    redactor.setEmails([]);

    const paragraph = document.querySelector("p");
    const destination = document.querySelector("aside");

    if (!paragraph || !destination) {
      throw new TypeError("Expected source and destination elements");
    }

    paragraph.remove();
    destination.append(paragraph);
    await flush();

    expect(destination.textContent).toBe(email);
  });

  it("updates emails and rescans while running", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.start();
    await flush();

    expect(document.body.textContent).toContain(email);

    redactor.setEmails([email]);
    await flush();

    expect(document.body.querySelector('[role="button"]')?.textContent).toMatch(
      DECOY_EMAIL_PATTERN
    );
  });
});

import { describe, expect, it, afterEach } from "vitest";

import { createRedactor } from "../src/lib/redact";
import {
  flush,
  setMarkup,
  DECOY_EMAIL_PATTERN,
  email,
  resetRedactorDocument,
} from "./redact-test-helpers";

describe("redaction restoration", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    resetRedactorDocument();
  });

  it("restores removed matches while keeping configured matches redacted", async () => {
    const second = "admin@other.io";
    setMarkup(document.body, `<p>${email} and ${second}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email, second]);
    redactor.start();
    await flush();

    redactor.setEmails([second]);

    expect(document.body.textContent).not.toContain(second);
    expect(document.body.querySelectorAll('[role="button"]')).toHaveLength(1);

    await flush();

    expect(document.body.textContent).toContain(email);
    expect(document.body.querySelectorAll('[role="button"]')).toHaveLength(1);
    expect(document.body.querySelector('[role="button"]')?.textContent).toMatch(
      DECOY_EMAIL_PATTERN
    );
  });

  it("keeps the longer overlapping address redacted immediately after a list change", async () => {
    const longerEmail = `${email}.au`;
    setMarkup(document.body, `<p>${longerEmail}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email, longerEmail]);
    redactor.start();
    await flush();

    redactor.setEmails([longerEmail]);

    expect(document.body.textContent).not.toContain(longerEmail);
    expect(document.body.querySelectorAll('[role="button"]')).toHaveLength(1);

    await flush();

    expect(document.body.textContent).not.toContain(longerEmail);
    expect(document.body.querySelectorAll('[role="button"]')).toHaveLength(1);
  });

  it("restores normalized redaction fragments before rescanning overlaps", async () => {
    const longerEmail = `${email}.au`;
    setMarkup(document.body, `<p>${longerEmail}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email, longerEmail]);
    redactor.start();
    await flush();

    document.body.querySelector("p")?.normalize();
    redactor.setEmails([longerEmail]);

    expect(document.body.textContent).not.toContain(longerEmail);
    expect(document.body.querySelectorAll('[role="button"]')).toHaveLength(1);

    await flush();

    expect(document.body.textContent).not.toContain(longerEmail);
    expect(document.body.querySelectorAll('[role="button"]')).toHaveLength(1);
  });

  it("rescans an edited adjacent text run without losing the page edit", async () => {
    const longerEmail = `${email}.au`;
    setMarkup(document.body, `<p>${longerEmail}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email, longerEmail]);
    redactor.start();
    await flush();

    const paragraph = document.body.querySelector("p");

    const suffix = [...(paragraph?.childNodes ?? [])].find(
      (node) => node instanceof Text && node.nodeValue === ".au"
    );

    if (suffix instanceof Text) {
      suffix.nodeValue = `${suffix.nodeValue} updated`;
    }

    redactor.setEmails([longerEmail]);

    expect(paragraph?.textContent).not.toContain(longerEmail);
    expect(paragraph?.textContent).toContain(" updated");

    await flush();

    expect(paragraph?.textContent).not.toContain(longerEmail);
    expect(paragraph?.textContent).toContain(" updated");
  });

  it("does not restore a removed generated nonempty text fragment", async () => {
    setMarkup(document.body, `<p>Contact ${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const paragraph = document.body.querySelector("p");

    const contact = [...(paragraph?.childNodes ?? [])].find(
      (node) => node instanceof Text && node.nodeValue === "Contact "
    );

    contact?.remove();

    redactor.setEmails([]);

    expect(paragraph?.textContent).toBe(email);
    expect(paragraph?.textContent).not.toContain("Contact");
  });

  it("does not restore a detached nonempty generated text fragment", async () => {
    setMarkup(document.body, `<p>Contact ${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const paragraph = document.body.querySelector("p");

    const prefix = [...(paragraph?.childNodes ?? [])].find(
      (node) => node instanceof Text && node.nodeValue === "Contact "
    );

    prefix?.remove();
    redactor.setEmails([]);

    expect(paragraph?.textContent).toBe(email);
  });

  it("does not restore text when every generated fragment node was removed", async () => {
    setMarkup(document.body, `<p>Contact ${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const paragraph = document.querySelector("p");

    if (!paragraph) {
      throw new TypeError("Expected a redacted paragraph");
    }

    paragraph.replaceChildren();
    redactor.setEmails([]);

    expect(paragraph.textContent).toBe("");
  });

  it("handles detached text nodes reinserted in another subtree", async () => {
    setMarkup(document.body, "<p>plain text</p><aside></aside>");

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const text = document.querySelector("p")?.firstChild;
    const destination = document.querySelector("aside");

    if (!(text instanceof Text) || !destination) {
      throw new TypeError("Expected a text node and destination element");
    }

    text.remove();
    await flush();
    destination.append(text);
    await flush();

    expect(destination.textContent).toBe("plain text");
  });
});

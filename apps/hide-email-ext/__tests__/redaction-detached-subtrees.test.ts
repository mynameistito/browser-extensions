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

describe("detached redaction subtrees", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    resetRedactorDocument();
  });

  it("keeps a detached toggle redacted when reinserted with the same pattern", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const paragraph = document.querySelector("p");

    const wrapper = paragraph?.querySelector<HTMLElement>(
      '[data-redacted="toggle-container"]'
    );

    if (!paragraph || !wrapper) {
      throw new TypeError("Expected a redacted toggle wrapper");
    }

    wrapper.remove();
    await flush();
    paragraph.append(wrapper);
    await flush();

    expect(wrapper.querySelector('[role="button"]')?.textContent).toMatch(
      DECOY_EMAIL_PATTERN
    );
    redactor.setEmails([]);
    expect(paragraph.textContent).toBe(email);
  });

  it("restores detached content when its email configuration is cleared", async () => {
    setMarkup(document.body, `<section><p>${email}</p></section>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const section = document.body.querySelector("section");
    section?.remove();
    await flush();
    redactor.setEmails([]);

    expect(section?.querySelector('[role="button"]')).toBeNull();
    expect(section?.textContent).toBe(email);
  });

  it("keeps detached subtrees redacted when reinserted with the same configuration", async () => {
    setMarkup(document.body, `<section><p>${email}</p></section>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const section = document.querySelector("section");

    if (!section) {
      throw new TypeError("Expected a redacted subtree fixture");
    }

    section.remove();
    await flush();
    document.body.append(section);
    await flush();

    expect(section.querySelector('[role="button"]')).not.toBeNull();

    redactor.setEmails([]);
    expect(section.textContent).toBe(email);
  });

  it("tracks one subtree only once when it is removed twice in one batch", async () => {
    setMarkup(document.body, `<section><p>${email}</p></section>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const section = document.querySelector("section");

    if (!section) {
      throw new TypeError("Expected a redacted subtree fixture");
    }

    section.remove();
    document.body.append(section);
    section.remove();
    await flush();
    redactor.setEmails([]);

    expect(section.textContent).toBe(email);
  });

  it("restores an individually detached toggle on clear and stop", async () => {
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

    redactor.setEmails([]);
    redactor.stop();

    if (wrapper) {
      paragraph?.append(wrapper);
    }

    expect(wrapper?.textContent).toBe(email);
    expect(wrapper?.querySelector('[role="button"]')).toBeNull();
    expect(wrapper?.dataset.redacted).toBeUndefined();
    expect(paragraph?.textContent).toBe(email);
  });

  it("restores detached redactions when the list is cleared before reinsertion", async () => {
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
    await flush();
    redactor.setEmails([]);

    if (section) {
      document.body.append(section);
    }

    await flush();

    expect(section?.querySelector('[role="button"]')).toBeNull();
    expect(section?.querySelector("p")?.textContent).toBe(email);
    expect(section?.querySelector("a")?.textContent).toBe(`Contact ${email}`);
    expect(section?.querySelector("a")?.getAttribute("title")).toBe(
      `Contact ${email}`
    );
  });

  it("rescans detached redactions with the updated list on reinsertion", async () => {
    const second = "admin@other.io";
    setMarkup(
      document.body,
      `<section><p>${email} and ${second}</p><a href="/profile" title="Contact ${second}">Contact ${second}</a></section>`
    );

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const section = document.body.querySelector("section");
    section?.remove();
    await flush();
    redactor.setEmails([second]);

    if (section) {
      document.body.append(section);
    }

    await Promise.resolve();

    expect(section?.textContent).not.toContain(second);

    await flush();

    const paragraphText = section?.querySelector("p")?.textContent;

    expect({
      linkText: section?.querySelector("a")?.textContent,
      linkTitle: section?.querySelector("a")?.getAttribute("title"),
      toggles: section?.querySelectorAll('[role="button"]').length,
    }).toStrictEqual({
      linkText: `Contact ${REDACTION_TOKEN}`,
      linkTitle: `Contact ${REDACTION_TOKEN}`,
      toggles: 1,
    });
    expect(paragraphText).toContain(email);
    expect(paragraphText).not.toContain(second);

    redactor.setEmails([]);
    expect({
      linkText: section?.querySelector("a")?.textContent,
      linkTitle: section?.querySelector("a")?.getAttribute("title"),
      paragraph: section?.querySelector("p")?.textContent,
    }).toStrictEqual({
      linkText: `Contact ${second}`,
      linkTitle: `Contact ${second}`,
      paragraph: `${email} and ${second}`,
    });
  });
});

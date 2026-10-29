import { describe, expect, it, afterEach } from "vitest";

import {
  createRedactor,
  pruneDetachedWrapperReferences,
} from "../src/lib/redact";
import { REDACTION_TOKEN } from "../src/lib/types";
import {
  flush,
  setMarkup,
  email,
  resetRedactorDocument,
} from "./redact-test-helpers";

describe("wrapper restoration", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    resetRedactorDocument();
  });

  it("retains detached state when a regenerated wrapper is removed in the same batch", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    redactor.setEmails([email]);
    const paragraph = document.body.querySelector("p");

    const wrapper = paragraph?.querySelector<HTMLElement>(
      '[data-redacted="toggle-container"]'
    );

    wrapper?.remove();
    await flush();

    redactor.setEmails([]);
    redactor.stop();

    if (wrapper) {
      paragraph?.append(wrapper);
    }

    expect(wrapper?.textContent).toBe(email);
    expect(wrapper?.querySelector('[role="button"]')).toBeNull();
    expect(wrapper?.dataset.redacted).toBeUndefined();
  });

  it("prunes collected detached-wrapper references deterministically", () => {
    const reference = new WeakRef(document.createElement("span"));
    Object.defineProperty(reference, "deref", {
      value: () => {},
    });
    const references = new Set([reference]);

    pruneDetachedWrapperReferences(references);

    expect(references.size).toBe(0);
  });

  it("restores text matches in later siblings after a text group is restored", async () => {
    setMarkup(document.body, `<p>${email}<b>${email}</b></p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    redactor.setEmails([]);

    expect(document.body.querySelector("p")?.textContent).toBe(
      `${email}${email}`
    );
    expect(document.body.querySelector("b")?.textContent).toBe(email);
  });

  it("restores redacted link text and attributes when the list is cleared", async () => {
    setMarkup(
      document.body,
      `<a title="Contact ${email}">Contact ${email}</a>`
    );

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const linkBeforeClear = document.body.querySelector("a");
    expect(linkBeforeClear?.getAttribute("title")).toBe(
      `Contact ${REDACTION_TOKEN}`
    );

    for (const element of document.body.querySelectorAll("*")) {
      for (const attribute of element.attributes) {
        expect(attribute.value).not.toContain(email);
      }
    }

    redactor.setEmails([]);
    await flush();

    const link = document.body.querySelector("a");
    expect(link?.textContent).toBe(`Contact ${email}`);
    expect(link?.getAttribute("title")).toBe(`Contact ${email}`);
  });

  it("replaces matches and restores only addresses no longer configured", async () => {
    const second = "admin@other.io";
    const third = "team@sample.net";
    setMarkup(document.body, `<p>${email} ${second} ${third}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email, second]);
    redactor.start();
    await flush();

    redactor.setEmails([second, third]);
    await flush();

    expect(document.body.textContent).toContain(email);
    expect(document.body.querySelectorAll('[role="button"]')).toHaveLength(2);
    expect(document.body.textContent).not.toContain(second);
    expect(document.body.textContent).not.toContain(third);
  });

  it("restores dynamic link text with punctuation after clearing the list", async () => {
    setMarkup(document.body, "");

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    setMarkup(
      document.body,
      `<a href="mailto:${email}">Contact ${email}.</a><a href="/profile">Contact ${email}.</a>`
    );
    await flush();
    await flush();

    expect(document.body.textContent).not.toContain(email);

    redactor.setEmails([]);
    await flush();

    expect(document.body.querySelectorAll("a")[0]?.textContent).toBe(
      `Contact ${email}.`
    );
    expect(document.body.querySelectorAll("a")[1]?.textContent).toBe(
      `Contact ${email}.`
    );
  });
});

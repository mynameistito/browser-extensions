import { describe, expect, it, afterEach } from "vitest";

import { createRedactor } from "../src/lib/redact";
import { REDACTION_TOKEN } from "../src/lib/types";
import {
  flush,
  setMarkup,
  email,
  resetRedactorDocument,
} from "./redact-test-helpers";

describe("moved and adjacent text", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    resetRedactorDocument();
  });

  it("discards detached subtree references after their nodes are collected", async () => {
    setMarkup(document.body, `<section><p>${email}</p></section>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const section = document.querySelector("section");

    if (!section) {
      throw new TypeError("Expected a detached subtree fixture");
    }

    const originalWeakRef = Object.getOwnPropertyDescriptor(
      globalThis,
      "WeakRef"
    );

    class CollectedWeakRef<T extends object> extends WeakRef<T> {
      private readonly collected = true;

      override deref(): T | undefined {
        return this.collected ? undefined : super.deref();
      }
    }

    Object.defineProperty(globalThis, "WeakRef", {
      configurable: true,
      value: CollectedWeakRef,
    });

    try {
      section.remove();
      await flush();
      document.body.append(document.createElement("div"));
      await flush();
      redactor.setEmails([email]);
    } finally {
      if (originalWeakRef) {
        Object.defineProperty(globalThis, "WeakRef", originalWeakRef);
      }
    }

    expect(document.body.querySelector("section")).toBeNull();
  });

  it("does not duplicate generated text after normalizing adjacent originals", async () => {
    setMarkup(document.body, "<p>Before </p>");
    const paragraph = document.body.querySelector("p");
    paragraph?.append(document.createTextNode(`Contact ${email}`));

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    paragraph?.normalize();
    redactor.setEmails([]);

    expect(paragraph?.textContent).toBe(`Before Contact ${email}`);
  });

  it("immediately redacts moved text nodes from links", async () => {
    setMarkup(document.body, `<a href="/old">${email}</a><a href="/new"></a>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const [source, destination] = document.body.querySelectorAll("a");
    const movedText = source?.firstChild;

    if (movedText instanceof Text) {
      destination?.append(movedText);
    }

    expect(destination?.textContent).not.toContain(email);

    await flush();

    expect(destination?.textContent).not.toContain(email);
    expect(destination?.textContent).toContain(REDACTION_TOKEN);
  });

  it("rescans synchronously moved elements from their destination subtree", async () => {
    setMarkup(
      document.body,
      `<section><p>${email}</p></section><aside></aside>`
    );

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const paragraph = document.body.querySelector("p");
    const destination = document.body.querySelector("aside");

    if (paragraph && destination) {
      paragraph.remove();
      destination.append(paragraph);
    }

    await flush();

    expect(destination?.querySelector('[role="button"]')).not.toBeNull();

    redactor.setEmails([]);
    expect(destination?.textContent).toBe(email);
  });
});

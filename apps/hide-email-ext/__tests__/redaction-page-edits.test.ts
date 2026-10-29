import { describe, expect, it, afterEach } from "vitest";

import { createRedactor } from "../src/lib/redact";
import {
  flush,
  setMarkup,
  email,
  resetRedactorDocument,
} from "./redact-test-helpers";

describe("page edits and generated wrappers", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    resetRedactorDocument();
  });

  it("does not restore a wrapper whose contents were changed by the page", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const wrapper = document.body.querySelector<HTMLElement>(
      '[data-redacted="toggle-container"]'
    );

    wrapper?.append(document.createElement("em"));

    redactor.setEmails([]);

    expect(wrapper?.querySelector('[role="button"]')).not.toBeNull();
    expect(wrapper?.querySelector("em")).not.toBeNull();
  });

  it("does not restore a wrapper after the page reorders its generated children", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const wrapper = document.body.querySelector<HTMLElement>(
      '[data-redacted="toggle-container"]'
    );

    const toggle = wrapper?.querySelector<HTMLElement>('[role="button"]');
    const tooltip = wrapper?.querySelector<HTMLElement>('[role="tooltip"]');

    if (!wrapper || !toggle || !tooltip) {
      throw new TypeError("Expected a complete redaction wrapper");
    }

    wrapper.replaceChildren(tooltip, toggle);
    redactor.setEmails([]);

    expect(wrapper.firstChild).toBe(tooltip);
    expect(wrapper.lastChild).toBe(toggle);
  });

  it("scans newly added standalone text nodes", async () => {
    setMarkup(document.body, "<p>Contact</p>");

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    const paragraph = document.body.querySelector("p");
    paragraph?.append(document.createTextNode(` ${email}`));
    await flush();

    expect(paragraph?.querySelector('[role="button"]')).not.toBeNull();
  });

  it("ignores comments added beside text content", async () => {
    setMarkup(document.body, "<p>Contact</p>");

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    document.body.querySelector("p")?.append(document.createComment("page"));
    await flush();

    expect(document.body.querySelector('[role="button"]')).toBeNull();
  });

  it("preserves page-updated attributes when clearing the email list", async () => {
    setMarkup(document.body, `<span title="${email}">label</span>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const element = document.body.querySelector("span");
    element?.setAttribute("title", "updated by page");
    redactor.setEmails([]);

    expect(element?.getAttribute("title")).toBe("updated by page");
  });

  it("preserves page edits to redacted text and attributes on restore", async () => {
    setMarkup(
      document.body,
      `<p>${email}</p><span title="Contact ${email}">label</span>`
    );

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const text = document.body.querySelector("p")?.firstChild;
    const attribute = document.body.querySelector("span");

    if (!(text instanceof Text) || attribute === null) {
      throw new TypeError("Expected redacted text and attribute");
    }

    text.nodeValue = "page edited";
    attribute.setAttribute("title", "page edited");
    await flush();
    redactor.setEmails([]);

    expect(text.nodeValue).toBe("page edited");
    expect(attribute.getAttribute("title")).toBe("page edited");
  });

  it("does not restore a redacted link after its text is edited by the page", async () => {
    setMarkup(document.body, `<a href="#">${email}</a>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const link = document.body.querySelector("a");

    if (!link?.firstChild || !(link.firstChild instanceof Text)) {
      throw new TypeError("Expected a text node inside the link");
    }

    link.firstChild.nodeValue = "page changed this";
    redactor.setEmails([]);
    expect(link.textContent).toBe("page changed this");
  });

  it("keeps edited generated text when restoring a grouped text run", async () => {
    const paragraph = document.createElement("p");
    paragraph.append(
      document.createTextNode("Contact "),
      document.createTextNode(email)
    );
    document.body.replaceChildren(paragraph);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const textNodes = [...paragraph.childNodes].filter(
      (node): node is Text => node instanceof Text
    );

    const trailingText = textNodes.at(-1);
    trailingText?.appendData(" page edit");

    redactor.setEmails([]);
    expect(paragraph.textContent).toContain(" page edit");
    expect(paragraph.textContent).toContain(email);
  });

  it("merges adjacent text nodes before redacting a split email address", async () => {
    const paragraph = document.createElement("p");
    paragraph.append(
      document.createTextNode("Contact "),
      document.createTextNode("user@"),
      document.createTextNode("example.com")
    );
    document.body.replaceChildren(paragraph);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    expect(paragraph.querySelector('[role="button"]')).not.toBeNull();
    redactor.setEmails([]);
    expect(paragraph.textContent).toBe(`Contact ${email}`);
  });

  it("does not restore a deleted match when another match's group is restored", async () => {
    const second = "admin@other.io";
    setMarkup(document.body, `<p>${email} and ${second}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email, second]);
    redactor.start();
    await flush();

    const paragraph = document.body.querySelector("p");

    const wrappers = paragraph?.querySelectorAll<HTMLElement>(
      '[data-redacted="toggle-container"]'
    );

    wrappers?.[0]?.remove();
    await flush();
    paragraph?.remove();
    await flush();

    redactor.setEmails([]);

    expect(paragraph?.textContent).not.toContain(email);
    expect(paragraph?.textContent).toContain(second);
  });

  it("preserves adjacent editable text nodes during scanning", async () => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    const firstText = document.createTextNode("Contact ");
    const secondText = document.createTextNode(email);
    editable.append(firstText, secondText);
    document.body.replaceChildren(editable);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    expect(editable.childNodes[0]).toBe(firstText);
    expect(editable.childNodes[1]).toBe(secondText);
    expect(editable.textContent).toBe(`Contact ${email}`);

    firstText.nodeValue = "Edited ";
    expect(editable.childNodes[0]).toBe(firstText);
    expect(editable.childNodes[1]).toBe(secondText);
  });
});

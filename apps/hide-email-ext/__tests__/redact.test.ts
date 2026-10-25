import { setTimeout as sleep } from "node:timers/promises";

import { it, afterEach, describe, expect, vi } from "vitest";

import {
  createRedactor,
  pruneDetachedWrapperReferences,
} from "../src/lib/redact";
import { REDACTION_TOKEN } from "../src/lib/types";

const flush = async (): Promise<void> => {
  await sleep(200);
};

const email = "user@example.com";
const DECOY_EMAIL_PATTERN = /^[a-z0-9]{8}@[a-z0-9]{7}\.tld$/u;

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

  it("blurs matching email text and reveals it when activated", async () => {
    setMarkup(document.body, `<p>Contact me at ${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    const toggle = document.body.querySelector<HTMLElement>('[role="button"]');
    const decoyEmail = toggle?.textContent ?? "";

    expect(decoyEmail).toMatch(DECOY_EMAIL_PATTERN);
    expect(decoyEmail).not.toBe(email);
    expect({
      ariaLabel: toggle?.getAttribute("aria-label"),
      ariaPressed: toggle?.getAttribute("aria-pressed"),
      filter: toggle?.style.filter,
      transition: toggle?.style.transition,
    }).toStrictEqual({
      ariaLabel: "Toggle email visibility",
      ariaPressed: "false",
      filter: "blur(4px)",
      transition: "filter 150ms cubic-bezier(0.4, 0, 0.2, 1)",
    });

    toggle?.dispatchEvent(
      new Event("click", { bubbles: true, cancelable: true })
    );

    expect({
      ariaLabel: toggle?.getAttribute("aria-label"),
      ariaPressed: toggle?.getAttribute("aria-pressed"),
      filter: toggle?.style.filter,
      text: toggle?.textContent,
    }).toStrictEqual({
      ariaLabel: email,
      ariaPressed: "true",
      filter: "none",
      text: email,
    });

    toggle?.dispatchEvent(
      new Event("click", { bubbles: true, cancelable: true })
    );

    expect({
      ariaLabel: toggle?.getAttribute("aria-label"),
      ariaPressed: toggle?.getAttribute("aria-pressed"),
      filter: toggle?.style.filter,
      text: toggle?.textContent,
    }).toStrictEqual({
      ariaLabel: "Toggle email visibility",
      ariaPressed: "false",
      filter: "blur(4px)",
      text: decoyEmail,
    });
  });

  it("toggles email visibility with Enter and Space", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    const toggle = document.body.querySelector<HTMLElement>('[role="button"]');

    for (const key of ["Enter", " "]) {
      const reveal = new window.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
      });

      toggle?.dispatchEvent(reveal);

      expect({
        defaultPrevented: reveal.defaultPrevented,
        filter: toggle?.style.filter,
        pressed: toggle?.getAttribute("aria-pressed"),
      }).toStrictEqual({
        defaultPrevented: true,
        filter: "none",
        pressed: "true",
      });

      const hide = new window.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
      });

      toggle?.dispatchEvent(hide);

      expect({
        defaultPrevented: hide.defaultPrevented,
        filter: toggle?.style.filter,
        pressed: toggle?.getAttribute("aria-pressed"),
      }).toStrictEqual({
        defaultPrevented: true,
        filter: "blur(4px)",
        pressed: "false",
      });
    }
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

  it("dismisses the visible tooltip when the email is clicked", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();

    await flush();

    const toggle = document.body.querySelector<HTMLElement>('[role="button"]');

    const tooltip =
      toggle?.parentElement?.querySelector<HTMLElement>('[role="tooltip"]');

    toggle?.dispatchEvent(new Event("mouseenter"));
    await sleep(550);

    expect(tooltip?.style.display).toBe("block");

    toggle?.dispatchEvent(
      new Event("click", { bubbles: true, cancelable: true })
    );

    expect(toggle?.getAttribute("aria-pressed")).toBe("true");
    expect(tooltip?.textContent).toBe("Click to hide email");
    expect(tooltip?.style.display).toBe("none");
    expect(tooltip?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps mailto links clickable while redacting their email text", async () => {
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

    expect(receivedClick).toBeTruthy();
    expect(click.defaultPrevented).toBeFalsy();
  });

  it("keeps other links clickable while redacting their email text", async () => {
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

    expect(receivedClick).toBeTruthy();
    expect(click.defaultPrevented).toBeFalsy();
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

  it("setEmails with empty array disables redaction", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([]);
    redactor.start();

    await flush();

    expect(document.body.textContent).toContain(email);
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

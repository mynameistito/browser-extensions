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

  it("masks IPv4 and IPv6 only while the IP setting is enabled", async () => {
    const ipv4 = "192.0.2.24";
    const ipv6 = "2001:db8::1";
    const invalidIpv6 = "1234:5678:9abc";
    setMarkup(
      document.body,
      `<p>IPs: ${ipv4} and ${ipv6}; invalid: ${invalidIpv6}</p>`
    );

    redactor = createRedactor();
    redactor.start();
    await flush();
    expect(document.body.textContent).toBe(
      `IPs: ${ipv4} and ${ipv6}; invalid: ${invalidIpv6}`
    );

    redactor.setHideIpAddresses(true);
    await flush();

    const toggles = [
      ...document.body.querySelectorAll<HTMLElement>('[role="button"]'),
    ];

    expect(toggles).toHaveLength(2);

    const decoyIpv4 = toggles[0]?.textContent ?? "";
    const decoyIpv6 = toggles[1]?.textContent ?? "";
    expect({
      ipv4OctetsAreValid: decoyIpv4
        .split(".")
        .every((octet) => Number(octet) <= 255),
      ipv4PatternMatches: /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(decoyIpv4),
      ipv6PatternMatches: /^[a-f\d]{4}(?::[a-f\d]{4}){7}$/u.test(decoyIpv6),
      labels: toggles.map((toggle) => toggle.getAttribute("aria-label")),
    }).toStrictEqual({
      ipv4OctetsAreValid: true,
      ipv4PatternMatches: true,
      ipv6PatternMatches: true,
      labels: ["Toggle IP address visibility", "Toggle IP address visibility"],
    });

    for (const toggle of toggles) {
      toggle.dispatchEvent(
        new Event("click", { bubbles: true, cancelable: true })
      );
    }

    expect(toggles.map((toggle) => toggle.textContent)).toStrictEqual([
      ipv4,
      ipv6,
    ]);

    redactor.setHideIpAddresses(false);
    expect({
      hasVisibleToggle: document.body.querySelector('[role="button"]') !== null,
      text: document.body.textContent,
    }).toStrictEqual({
      hasVisibleToggle: false,
      text: `IPs: ${ipv4} and ${ipv6}; invalid: ${invalidIpv6}`,
    });
  });

  it("masks IP addresses before sentence punctuation and IPv4 ports", async () => {
    const ipv4WithPeriod = "198.51.100.7.";
    const ipv4WithPort = "203.0.113.9:8443";
    const ipv6WithPeriod = "2001:db8::1.";
    const originalText = `IPs: ${ipv4WithPeriod} port: ${ipv4WithPort} IPv6: ${ipv6WithPeriod}`;
    setMarkup(document.body, `<p>${originalText}</p>`);

    redactor = createRedactor();
    redactor.setHideIpAddresses(true);
    redactor.start();
    await flush();

    const toggles = [
      ...document.body.querySelectorAll<HTMLElement>('[role="button"]'),
    ];

    expect(toggles).toHaveLength(3);

    for (const toggle of toggles) {
      toggle.dispatchEvent(
        new Event("click", { bubbles: true, cancelable: true })
      );
    }

    const paragraph = document.body.querySelector("p");

    const visibleText = [...(paragraph?.childNodes ?? [])]
      .map((node) => {
        if (node instanceof Text) {
          return node.data;
        }

        if (node instanceof Element) {
          return (
            node.querySelector<HTMLElement>('[data-redacted="toggle"]')
              ?.textContent ?? ""
          );
        }

        return "";
      })
      .join("");

    expect(visibleText).toStrictEqual(originalText);
  });

  it("does not merge text nodes for invalid IPv6 candidates", async () => {
    const nodeValues = ["12", ":", "30", ":", "45"];

    const textNodes = nodeValues.map((value) => document.createTextNode(value));

    const paragraph = document.createElement("p");
    paragraph.append(...textNodes);
    document.body.append(paragraph);

    redactor = createRedactor();
    redactor.setHideIpAddresses(true);
    redactor.start();
    await flush();

    expect({
      sameNodes: [...paragraph.childNodes].every(
        (node, index) => node === textNodes[index]
      ),
      values: textNodes.map((node) => node.data),
    }).toStrictEqual({ sameNodes: true, values: nodeValues });
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

    toggle?.dispatchEvent(new Event("mouseenter"));
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

  it("hides tooltips when hover ends or focus leaves without a hover", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const toggle = document.body.querySelector<HTMLElement>('[role="button"]');

    const tooltip =
      document.body.querySelector<HTMLElement>('[role="tooltip"]');

    toggle?.dispatchEvent(new Event("focus"));
    expect(tooltip?.style.display).toBe("block");
    toggle?.dispatchEvent(new Event("blur"));
    expect(tooltip?.style.display).toBe("none");

    toggle?.dispatchEvent(new Event("mouseenter"));
    toggle?.dispatchEvent(new Event("mouseleave"));
    await sleep(525);
    expect(tooltip?.style.display).toBe("none");

    toggle?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(toggle?.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps a focused tooltip visible while hover changes and reschedules on blur", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const toggle = document.body.querySelector<HTMLElement>('[role="button"]');

    const tooltip =
      document.body.querySelector<HTMLElement>('[role="tooltip"]');

    toggle?.dispatchEvent(new Event("mouseenter"));
    toggle?.dispatchEvent(new Event("focus"));
    toggle?.dispatchEvent(new Event("mouseleave"));
    expect(tooltip?.style.display).toBe("block");

    toggle?.dispatchEvent(new Event("mouseenter"));
    toggle?.dispatchEvent(new Event("blur"));
    expect(tooltip?.style.display).toBe("none");
    await sleep(550);
    expect(tooltip?.style.display).toBe("block");
  });

  it("does not show the hover tooltip when focus is gained before its delay", async () => {
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await flush();

    const toggle = document.body.querySelector<HTMLElement>('[role="button"]');

    const tooltip =
      document.body.querySelector<HTMLElement>('[role="tooltip"]');

    toggle?.dispatchEvent(new Event("mouseenter"));
    toggle?.dispatchEvent(new Event("focus"));
    await sleep(525);

    expect(tooltip?.style.display).toBe("block");
    expect(tooltip?.getAttribute("aria-hidden")).toBe("false");
  });

  it("keeps a focused tooltip visible if a cancelled hover callback races", async () => {
    vi.useFakeTimers();
    setMarkup(document.body, `<p>${email}</p>`);

    redactor = createRedactor();
    redactor.setEmails([email]);
    redactor.start();
    await vi.advanceTimersByTimeAsync(200);

    const toggle = document.querySelector<HTMLElement>('[role="button"]');
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]');

    if (!toggle || !tooltip) {
      throw new TypeError("Expected a redaction toggle and tooltip");
    }

    const clearTimeoutSpy = vi
      .spyOn(globalThis, "clearTimeout")
      .mockImplementation(() => {});

    try {
      toggle.dispatchEvent(new Event("mouseenter"));
      toggle.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(500);

      expect(tooltip.style.display).toBe("block");
    } finally {
      clearTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
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

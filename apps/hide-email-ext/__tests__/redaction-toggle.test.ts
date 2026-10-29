import { describe, expect, it, afterEach } from "vitest";

import { createRedactor } from "../src/lib/redact";
import {
  flush,
  setMarkup,
  DECOY_EMAIL_PATTERN,
  email,
  resetRedactorDocument,
} from "./redact-test-helpers";

describe("redaction toggle behavior", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    resetRedactorDocument();
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
});

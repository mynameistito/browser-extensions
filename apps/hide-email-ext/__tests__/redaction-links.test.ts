import { describe, expect, it, afterEach } from "vitest";

import { createRedactor } from "../src/lib/redact";
import { REDACTION_TOKEN } from "../src/lib/types";
import {
  flush,
  sleep,
  setMarkup,
  email,
  resetRedactorDocument,
} from "./redact-test-helpers";

describe("redaction in links", () => {
  let redactor: ReturnType<typeof createRedactor> | null = null;

  afterEach(() => {
    redactor?.stop();
    redactor = null;
    resetRedactorDocument();
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

  it("reveals linked IPs before allowing the link to navigate", async () => {
    const ipv6 = "2001:db8::1";
    setMarkup(
      document.body,
      `<a href="/lookup">IPv6: ${ipv6}</a><a href="/clock">Time: 12:30:45</a><a href="/info">IPv6 lookup: unavailable</a>`
    );

    redactor = createRedactor();
    redactor.setHideIpAddresses(true);
    redactor.start();
    await flush();

    const [link, clockLink, noMatchLink] = document.body.querySelectorAll("a");
    const toggle = link?.querySelector<HTMLElement>('[role="button"]');

    expect({
      clockLinkHasToggle: Boolean(clockLink?.querySelector('[role="button"]')),
      clockLinkText: clockLink?.textContent,
      decoyIsBlurred: toggle?.style.filter === "blur(4px)",
      decoyMatchesIpv6: /^[a-f\d]{4}(?::[a-f\d]{4}){7}$/iu.test(
        toggle?.textContent ?? ""
      ),
      ipv6LinkHasLabel: link?.textContent?.includes("IPv6:") ?? false,
      noMatchLinkHasToggle: Boolean(
        noMatchLink?.querySelector('[role="button"]')
      ),
      noMatchLinkText: noMatchLink?.textContent,
      toggleCount: document.body.querySelectorAll('[role="button"]').length,
    }).toStrictEqual({
      clockLinkHasToggle: false,
      clockLinkText: "Time: 12:30:45",
      decoyIsBlurred: true,
      decoyMatchesIpv6: true,
      ipv6LinkHasLabel: true,
      noMatchLinkHasToggle: false,
      noMatchLinkText: "IPv6 lookup: unavailable",
      toggleCount: 1,
    });

    let linkWasClicked = false;
    link?.addEventListener("click", () => {
      linkWasClicked = true;
    });
    const revealClick = new Event("click", { bubbles: true, cancelable: true });
    toggle?.dispatchEvent(revealClick);

    expect({
      defaultPrevented: revealClick.defaultPrevented,
      linkWasClicked,
      revealedText: toggle?.textContent,
    }).toStrictEqual({
      defaultPrevented: true,
      linkWasClicked: false,
      revealedText: ipv6,
    });

    const navigateClick = new Event("click", {
      bubbles: true,
      cancelable: true,
    });

    toggle?.dispatchEvent(navigateClick);

    expect({
      defaultPrevented: navigateClick.defaultPrevented,
      linkWasClicked,
      revealedText: toggle?.textContent,
    }).toStrictEqual({
      defaultPrevented: false,
      linkWasClicked: true,
      revealedText: ipv6,
    });
  });
});

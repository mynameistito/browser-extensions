import { setTimeout as delay } from "node:timers/promises";

/**
 * Wait for a requested duration in asynchronous DOM behavior tests.
 * @param milliseconds - Number of milliseconds to wait.
 * @returns A promise that settles after the duration.
 */
export const sleep = async (milliseconds: number): Promise<void> => {
  await delay(milliseconds);
};

/** Shared address used by the redactor behavior suites. */
export const email = "user@example.com";

/** Pattern for generated email decoys. */
export const DECOY_EMAIL_PATTERN = /^[a-z0-9]{8}@[a-z0-9]{7}\.tld$/u;

/** Wait for the observer's scheduled mutation flush. */
export const flush = async (): Promise<void> => {
  await sleep(200);
};

/**
 * Replace an element's children with parsed HTML markup.
 * @param element - Element whose children are replaced.
 * @param markup - HTML markup to parse into child nodes.
 */
export const setMarkup = (element: Element, markup: string): void => {
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  element.replaceChildren(...parsed.body.childNodes);
};

/** Clear the document state modified by a redactor test. */
export const resetRedactorDocument = (): void => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute("title");
  document.documentElement.removeAttribute("aria-label");
  document.documentElement.removeAttribute("alt");
  document.documentElement.removeAttribute("placeholder");
};

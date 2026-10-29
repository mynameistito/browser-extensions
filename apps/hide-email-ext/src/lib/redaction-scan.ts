import { isValidMatch, replaceMatches } from "./redaction-address";
import type { RedactorRestorations } from "./redaction-state";
import {
  hasAddressHint,
  shouldSkipCached,
  shouldSkipElement,
  tryReplaceText,
} from "./redaction-text";

const ARIA_LABEL = "aria-label";

/** Attributes whose visible values can contain a redacted address. */
export const SCANNABLE_ATTRS = [
  "title",
  ARIA_LABEL,
  "alt",
  "placeholder",
] as const;

/**
 * Redact configured matches in an element's scannable attributes.
 * @param root - Element whose attributes are inspected.
 * @param regex - Matcher for configured email and IP addresses.
 * @param skipCache - Cache of excluded ancestors for the current scan.
 * @param restorations - State used to restore the original attribute values.
 */
export const scanAttributes = (
  root: Element,
  regex: RegExp,
  skipCache: WeakMap<Element, boolean>,
  restorations: RedactorRestorations
): void => {
  if (shouldSkipElement(root)) {
    return;
  }

  if (shouldSkipCached(root, skipCache)) {
    return;
  }

  for (const attr of SCANNABLE_ATTRS) {
    const value = root.getAttribute(attr);

    if (value === null || value.length === 0 || !hasAddressHint(value)) {
      continue;
    }

    regex.lastIndex = 0;
    const replaced = replaceMatches(value, regex);

    if (replaced !== value) {
      root.setAttribute(attr, replaced);
      let attributes = restorations.attributes.get(root);

      if (!attributes) {
        attributes = new Map();
        restorations.attributes.set(root, attributes);
      }

      attributes.set(attr, {
        originalValue: value,
        redactedValue: replaced,
      });
    }
  }
};

const hasValidMatch = (value: string, regex: RegExp): boolean => {
  regex.lastIndex = 0;

  for (const match of value.matchAll(regex)) {
    if (isValidMatch(match[0])) {
      return true;
    }
  }

  return false;
};

const scanTextRun = (
  root: Node,
  textRun: Text[],
  regex: RegExp,
  skipCache: WeakMap<Element, boolean>,
  restorations: RedactorRestorations
): void => {
  const [firstText] = textRun;

  if (firstText === undefined || shouldSkipCached(firstText, skipCache)) {
    return;
  }

  const combined = textRun.map((text) => text.data).join("");
  regex.lastIndex = 0;

  if (
    hasValidMatch(combined, regex) &&
    textRun.every((text) => text.parentNode === root)
  ) {
    const matchedFirstText = firstText;
    const remainingText = textRun.slice(1);

    matchedFirstText.nodeValue = combined;

    for (const text of remainingText) {
      text.remove();
    }

    tryReplaceText(matchedFirstText, regex, skipCache, restorations);

    return;
  }

  for (const text of textRun) {
    tryReplaceText(text, regex, skipCache, restorations);
  }
};

const scanTextChildren = (
  root: Node,
  regex: RegExp,
  skipCache: WeakMap<Element, boolean>,
  restorations: RedactorRestorations
): void => {
  const children = [...root.childNodes];
  let index = 0;

  while (index < children.length) {
    const startIndex = index;
    const textRun: Text[] = [];

    while (true) {
      const candidate = children[index];

      if (!(candidate instanceof Text)) {
        break;
      }

      if (candidate.parentNode === root) {
        textRun.push(candidate);
      }

      index += 1;
    }

    scanTextRun(root, textRun, regex, skipCache, restorations);
    index = Math.max(index, startIndex + 1);
  }
};

/**
 * Scan text and attributes in a subtree and its descendants.
 * @param root - Subtree root to scan.
 * @param regex - Matcher for configured email and IP addresses.
 * @param skipCache - Cache of excluded ancestors for the current scan.
 * @param restorations - State used to restore redacted content.
 */
export const scanSubtree = (
  root: Node,
  regex: RegExp,
  skipCache: WeakMap<Element, boolean>,
  restorations: RedactorRestorations
): void => {
  scanTextChildren(root, regex, skipCache, restorations);

  if (root instanceof Element) {
    scanAttributes(root, regex, skipCache, restorations);

    for (const child of root.children) {
      scanSubtree(child, regex, skipCache, restorations);
    }
  }
};

/**
 * Apply the current redaction policy to one observed DOM mutation.
 * @param mutation - Mutation record to process.
 * @param regex - Matcher for configured email and IP addresses.
 * @param skipCache - Cache of excluded ancestors for the current scan.
 * @param restorations - State used to restore redacted content.
 */
export const scanMutation = (
  mutation: MutationRecord,
  regex: RegExp,
  skipCache: WeakMap<Element, boolean>,
  restorations: RedactorRestorations
): void => {
  if (mutation.type === "attributes" && mutation.target instanceof Element) {
    scanAttributes(mutation.target, regex, skipCache, restorations);
  }

  if (mutation.type === "characterData" && mutation.target instanceof Text) {
    tryReplaceText(mutation.target, regex, skipCache, restorations);
  }

  for (const node of mutation.addedNodes) {
    if (node instanceof Element) {
      scanSubtree(node, regex, skipCache, restorations);
    } else if (node.nodeType === Node.TEXT_NODE && node instanceof Text) {
      tryReplaceText(node, regex, skipCache, restorations);
    }
  }
};

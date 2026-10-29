import {
  classifyAddress,
  hasValidIpMatch,
  isValidMatch,
  replaceMatches,
} from "./redaction-address";
import type { RedactorRestorations } from "./redaction-state";
import { createRedactionToggle } from "./redaction-toggle";

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "SELECT",
]);

const ADDRESS_HINT_RE = /[@.:]/u;

/**
 * Check whether an element is excluded from redaction.
 * @param element - Element whose redaction exclusions are checked.
 * @returns Whether the element must be skipped.
 */
export const shouldSkipElement = (element: Element): boolean =>
  element instanceof HTMLElement &&
  (SKIP_TAGS.has(element.tagName) ||
    element.isContentEditable ||
    element.dataset.redacted !== undefined);

/**
 * Check whether text may contain an address worth matching.
 * @param value - Text to inspect.
 * @returns Whether it contains a likely address character.
 */
export const hasAddressHint = (value: string): boolean =>
  ADDRESS_HINT_RE.test(value);

/**
 * Check whether a node is under an excluded element.
 * @param node - Node to inspect.
 * @param cache - Cache of ancestor skip results for one scan.
 * @returns Whether this node should be skipped.
 */
export const shouldSkipCached = (
  node: Node,
  cache: WeakMap<Element, boolean>
): boolean => {
  const parent = node.parentElement;

  if (!parent) {
    return false;
  }

  const cached = cache.get(parent);

  if (cached !== undefined) {
    return cached;
  }

  let el: HTMLElement | null = parent;
  let result = false;

  while (el) {
    if (shouldSkipElement(el)) {
      result = true;
      break;
    }

    el = el.parentElement;
  }

  cache.set(parent, result);

  return result;
};

const hasRestorableGeneratedText = (
  generatedText: Map<Text, string>
): boolean =>
  [...generatedText].every(([node, value]) => {
    if (node.parentNode === null) {
      return value.length === 0;
    }

    return node.nodeValue === value;
  });

const areGeneratedNodesContiguous = (
  nodes: Node[],
  parent: ParentNode
): boolean =>
  nodes.every(
    (node, index) =>
      node.parentNode === parent &&
      (index === 0 || nodes[index - 1]?.nextSibling === node)
  );

const areWrappersRestorable = (
  wrappers: HTMLElement[],
  parent: ParentNode,
  restorations: RedactorRestorations
): boolean =>
  wrappers.every((wrapper) => {
    const restoration = restorations.wrappers.get(wrapper);

    return (
      wrapper.parentNode === parent &&
      restoration !== undefined &&
      restoration.isRestorable()
    );
  });

const replaceTextWithToggles = (
  text: Text,
  regex: RegExp,
  restorations: RedactorRestorations
): void => {
  const originalValue = text.nodeValue;

  if (originalValue === null) {
    return;
  }

  const fragment = text.ownerDocument.createDocumentFragment();
  const enclosingLink = text.parentElement?.closest("a[href]") ?? null;
  const wrappers: HTMLElement[] = [];
  let cursor = 0;
  let matched = false;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(originalValue)) !== null) {
    const matchEnd = regex.lastIndex;
    const matchedText = originalValue.slice(match.index, matchEnd);

    if (!isValidMatch(matchedText)) {
      continue;
    }

    matched = true;
    fragment.append(
      text.ownerDocument.createTextNode(
        originalValue.slice(cursor, match.index)
      )
    );

    const toggle = createRedactionToggle(
      text.ownerDocument,
      matchedText,
      classifyAddress(matchedText),
      enclosingLink !== null
    );

    wrappers.push(toggle.wrapper);
    restorations.wrappers.set(toggle.wrapper, toggle.restoration);
    fragment.append(toggle.wrapper);
    cursor = matchEnd;
  }

  if (matched) {
    fragment.append(
      text.ownerDocument.createTextNode(originalValue.slice(cursor))
    );

    const generatedNodes = [...fragment.childNodes];
    const generatedText = new Map<Text, string>();

    for (const node of generatedNodes) {
      if (node instanceof Text) {
        generatedText.set(node, node.data);
      }
    }

    const restoreOriginalText = (): boolean => {
      const liveNodes = generatedNodes.filter(
        (node): node is ChildNode & { parentNode: ParentNode } =>
          node.parentNode !== null
      );

      const [firstNode] = liveNodes;

      if (!firstNode) {
        return false;
      }

      const parent = firstNode.parentNode;

      if (
        !hasRestorableGeneratedText(generatedText) ||
        !areGeneratedNodesContiguous(liveNodes, parent) ||
        !areWrappersRestorable(wrappers, parent, restorations)
      ) {
        return false;
      }

      for (const wrapper of wrappers) {
        restorations.wrappers.get(wrapper)?.dispose();
        restorations.wrappers.delete(wrapper);
      }

      firstNode.before(text);

      for (const node of liveNodes) {
        node.remove();
      }

      return true;
    };

    for (const wrapper of wrappers) {
      const restoration = restorations.wrappers.get(wrapper);

      if (restoration) {
        restorations.wrappers.set(wrapper, {
          ...restoration,
          restoreGroup: restoreOriginalText,
        });
      }
    }

    text.replaceWith(fragment);
  }
};

/**
 * Redact eligible addresses in one text node.
 * @param text - Text node to inspect and update.
 * @param regex - Matcher for configured email and IP addresses.
 * @param skipCache - Cache of excluded ancestors for the current scan.
 * @param restorations - State used to restore redacted page content.
 */
export const tryReplaceText = (
  text: Text,
  regex: RegExp,
  skipCache: WeakMap<Element, boolean>,
  restorations: RedactorRestorations
): void => {
  if (text.nodeValue === null || text.nodeValue.length === 0) {
    return;
  }

  if (shouldSkipCached(text, skipCache)) {
    return;
  }

  if (!hasAddressHint(text.nodeValue)) {
    return;
  }

  regex.lastIndex = 0;

  const link = text.parentElement?.closest("a[href]");

  if (link !== null && link !== undefined) {
    const originalValue = text.nodeValue;

    if (hasValidIpMatch(originalValue, regex)) {
      replaceTextWithToggles(text, regex, restorations);

      return;
    }

    const redactedValue = replaceMatches(originalValue, regex);

    if (redactedValue === originalValue) {
      return;
    }

    text.nodeValue = redactedValue;
    restorations.text.set(text, {
      originalValue,
      redactedValue,
    });

    return;
  }

  replaceTextWithToggles(text, regex, restorations);
};

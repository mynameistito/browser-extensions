import {
  buildRegex,
  classifyAddress,
  hasValidIpMatch,
  isValidMatch,
  replaceMatches,
} from "./redaction-address";
import { createRedactionToggle } from "./redaction-toggle";
import type { ToggleRestoration } from "./redaction-toggle";

export { isValidIpv6 } from "./redaction-address";

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "SELECT",
]);

const ARIA_LABEL = "aria-label";
const SCANNABLE_ATTRS = ["title", ARIA_LABEL, "alt", "placeholder"] as const;

const ADDRESS_HINT_RE = /[@.:]/u;

interface TextRestoration {
  readonly originalValue: string;
  readonly redactedValue: string;
}

interface AttributeRestoration {
  readonly originalValue: string;
  readonly redactedValue: string;
}

interface RedactorRestorations {
  readonly text: WeakMap<Text, TextRestoration>;
  readonly attributes: WeakMap<Element, Map<string, AttributeRestoration>>;
  readonly wrappers: WeakMap<HTMLElement, ToggleRestoration>;
  readonly detachedWrappers: Set<WeakRef<HTMLElement>>;
  readonly detachedSubtrees: Set<WeakRef<Node>>;
}

const createRestorations = (): RedactorRestorations => ({
  attributes: new WeakMap(),
  detachedSubtrees: new Set(),
  detachedWrappers: new Set(),
  text: new WeakMap(),
  wrappers: new WeakMap(),
});

/** Remove collected wrapper references from the detached-wrapper registry.
 * @param references - Detached wrapper references to sweep.
 */
export const pruneDetachedWrapperReferences = (
  references: Set<WeakRef<HTMLElement>>
): void => {
  for (const reference of references) {
    if (reference.deref() === undefined) {
      references.delete(reference);
    }
  }
};

const shouldSkipCached = (
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
    if (
      SKIP_TAGS.has(el.tagName) ||
      el.isContentEditable ||
      el.dataset.redacted !== undefined
    ) {
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

const tryReplaceText = (
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

  if (!ADDRESS_HINT_RE.test(text.nodeValue)) {
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

const scanAttributes = (
  root: Element,
  regex: RegExp,
  skipCache: WeakMap<Element, boolean>,
  restorations: RedactorRestorations
): void => {
  if (
    root instanceof HTMLElement &&
    (SKIP_TAGS.has(root.tagName) ||
      root.isContentEditable ||
      root.dataset.redacted !== undefined)
  ) {
    return;
  }

  if (shouldSkipCached(root, skipCache)) {
    return;
  }

  for (const attr of SCANNABLE_ATTRS) {
    const value = root.getAttribute(attr);

    if (value === null || value.length === 0 || !ADDRESS_HINT_RE.test(value)) {
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

const scanSubtree = (
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

const scanMutation = (
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

const restoreTrackedText = (
  text: Text,
  restorations: RedactorRestorations
): void => {
  const restoration = restorations.text.get(text);

  if (!restoration) {
    return;
  }

  if (text.nodeValue === restoration.redactedValue) {
    text.nodeValue = restoration.originalValue;
  }

  restorations.text.delete(text);
};

const restoreTrackedElement = (
  element: Element,
  restorations: RedactorRestorations
): boolean => {
  const attributes = restorations.attributes.get(element);

  if (attributes) {
    for (const [name, restoration] of attributes) {
      if (element.getAttribute(name) === restoration.redactedValue) {
        element.setAttribute(name, restoration.originalValue);
      }
    }

    restorations.attributes.delete(element);
  }

  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const wrapper = restorations.wrappers.get(element);

  if (!wrapper) {
    return false;
  }

  if (
    wrapper.detached ||
    wrapper.restoreGroup === undefined ||
    !wrapper.restoreGroup()
  ) {
    wrapper.restore();
  }

  restorations.wrappers.delete(element);

  return true;
};

const restoreTrackedContent = (
  root: Node,
  restorations: RedactorRestorations
): void => {
  if (root instanceof Text) {
    restoreTrackedText(root, restorations);

    return;
  }

  if (root instanceof Element && restoreTrackedElement(root, restorations)) {
    return;
  }

  const children: Node[] = [];
  let child = root.firstChild;

  while (child !== null) {
    children.push(child);
    child = child.nextSibling;
  }

  for (const childNode of children) {
    if (childNode.parentNode === root) {
      restoreTrackedContent(childNode, restorations);
    }
  }
};

const cancelPendingHoverInSubtree = (
  root: Node,
  restorations: RedactorRestorations
): void => {
  if (root instanceof HTMLElement) {
    restorations.wrappers.get(root)?.cancelPendingHover();
  }

  for (const child of root.childNodes) {
    cancelPendingHoverInSubtree(child, restorations);
  }
};

const trackDetachedSubtree = (
  node: Node,
  restorations: RedactorRestorations
): void => {
  const alreadyTracked = [...restorations.detachedSubtrees].some(
    (reference) => reference.deref() === node
  );

  if (!alreadyTracked) {
    restorations.detachedSubtrees.add(new WeakRef(node));
  }
};

const cleanupRemovedSubtree = (
  node: Node,
  doc: Document,
  regex: RegExp | null,
  restorations: RedactorRestorations
): void => {
  const wasReinserted = doc.documentElement.contains(node);

  if (!wasReinserted && node instanceof HTMLElement) {
    const wrapper = restorations.wrappers.get(node);

    if (wrapper) {
      wrapper.cancelPendingHover();

      const detachedReference = wrapper.detachedReference ?? new WeakRef(node);

      restorations.detachedWrappers.add(detachedReference);
      restorations.wrappers.set(node, {
        ...wrapper,
        detached: true,
        detachedReference,
      });
      trackDetachedSubtree(node, restorations);

      return;
    }
  }

  if (!wasReinserted) {
    cancelPendingHoverInSubtree(node, restorations);
    trackDetachedSubtree(node, restorations);

    return;
  }

  restoreTrackedContent(node, restorations);

  if (regex) {
    if (node instanceof Text) {
      tryReplaceText(node, regex, new WeakMap(), restorations);
    } else {
      scanSubtree(node, regex, new WeakMap(), restorations);
    }
  }
};

const isReinsertedSubtree = (node: Node, root: Node): boolean =>
  root === node || (node instanceof Element && node.contains(root));

const refreshDetachedSubtrees = (
  node: Node,
  regex: RegExp | null,
  restorations: RedactorRestorations
): void => {
  for (const reference of restorations.detachedSubtrees) {
    const detachedRoot = reference.deref();

    if (detachedRoot === undefined) {
      restorations.detachedSubtrees.delete(reference);
    } else if (isReinsertedSubtree(node, detachedRoot)) {
      restorations.detachedSubtrees.delete(reference);

      if (regex) {
        if (detachedRoot instanceof Text) {
          tryReplaceText(detachedRoot, regex, new WeakMap(), restorations);
        } else {
          scanSubtree(detachedRoot, regex, new WeakMap(), restorations);
        }
      }
    }
  }
};

const refreshReinsertedWrappers = (
  node: Node,
  doc: Document,
  regex: RegExp | null,
  restorations: RedactorRestorations
): void => {
  if (!doc.documentElement.contains(node)) {
    return;
  }

  refreshDetachedSubtrees(node, regex, restorations);

  if (node instanceof HTMLElement) {
    const restoration = restorations.wrappers.get(node);

    if (restoration !== undefined && restoration.detached) {
      restorations.wrappers.set(node, { ...restoration, detached: false });

      if (restoration.detachedReference) {
        restorations.detachedWrappers.delete(restoration.detachedReference);
      }

      return;
    }
  }

  const children: Node[] = [];
  let child = node.firstChild;

  while (child !== null) {
    children.push(child);
    child = child.nextSibling;
  }

  for (const childNode of children) {
    if (childNode.parentNode === node) {
      refreshReinsertedWrappers(childNode, doc, regex, restorations);
    }
  }
};

const restoreDetachedWrappers = (restorations: RedactorRestorations): void => {
  for (const reference of restorations.detachedWrappers) {
    const wrapper = reference.deref();
    const shouldRestore = wrapper !== undefined && !wrapper.isConnected;

    if (shouldRestore && wrapper !== undefined) {
      restoreTrackedContent(wrapper, restorations);
    }

    restorations.detachedWrappers.delete(reference);
  }
};

const restoreDetachedSubtrees = (restorations: RedactorRestorations): void => {
  for (const reference of restorations.detachedSubtrees) {
    const root = reference.deref();

    if (root !== undefined && !root.isConnected) {
      restoreTrackedContent(root, restorations);
    }

    restorations.detachedSubtrees.delete(reference);
  }
};

const reconcileDetachedSubtrees = (
  restorations: RedactorRestorations,
  regex: RegExp | null
): void => {
  for (const reference of restorations.detachedSubtrees) {
    const root = reference.deref();

    if (root === undefined) {
      restorations.detachedSubtrees.delete(reference);
      continue;
    }

    if (!root.isConnected) {
      restoreTrackedContent(root, restorations);

      if (regex) {
        if (root instanceof Text) {
          tryReplaceText(root, regex, new WeakMap(), restorations);
        } else {
          scanSubtree(root, regex, new WeakMap(), restorations);
        }
      }
    }
  }
};

/** Controls the email redaction observer. */
export interface Redactor {
  /** Replace the email list used by the redactor. */
  setEmails: (emails: string[]) => void;
  /** Enable or disable automatic IPv4 and IPv6 masking. */
  setHideIpAddresses: (enabled: boolean) => void;
  /** Begin observing and redact the existing document content. */
  start: () => void;
  /** Stop observing and cancel queued scans. */
  stop: () => void;
}

/**
 * Create an observer that redacts matching email addresses in a document.
 * @param root - Document to scan, defaulting to the current document.
 * @returns Controls for updating, starting, and stopping the redactor.
 */
export const createRedactor = (root?: Document): Redactor => {
  const doc = root ?? document;
  let regex: RegExp | null = null;
  let emails: string[] = [];
  let hideIpAddresses = false;
  let observer: MutationObserver | null = null;
  let scheduled = false;
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingIdle: number | null = null;
  let pendingMutations: MutationRecord[] = [];
  let skipCache = new WeakMap<Element, boolean>();
  const restorations = createRestorations();

  const processMutationRecords = (
    mutations: readonly MutationRecord[],
    activeRegex: RegExp | null
  ): void => {
    pruneDetachedWrapperReferences(restorations.detachedWrappers);

    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        cleanupRemovedSubtree(node, doc, activeRegex, restorations);
      }
    }

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        refreshReinsertedWrappers(node, doc, activeRegex, restorations);
      }
    }
  };

  const flush = (mutations: MutationRecord[]): void => {
    skipCache = new WeakMap<Element, boolean>();

    if (!regex) {
      return;
    }

    for (const mutation of mutations) {
      scanMutation(mutation, regex, skipCache, restorations);
    }
  };

  const scheduleFlush = (mutations: MutationRecord[]): void => {
    pendingMutations.push(...mutations);

    if (scheduled) {
      return;
    }

    scheduled = true;

    const run = () => {
      const captured = pendingMutations;
      pendingMutations = [];
      scheduled = false;
      pendingTimeout = null;
      pendingIdle = null;

      flush(captured);
    };

    if ("requestIdleCallback" in window) {
      pendingIdle = requestIdleCallback(run, { timeout: 500 });
    } else {
      pendingTimeout = setTimeout(run, 100);
    }
  };

  const cancelScheduledFlush = (): void => {
    if (pendingTimeout !== null) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }

    if (pendingIdle !== null) {
      cancelIdleCallback(pendingIdle);
      pendingIdle = null;
    }

    scheduled = false;
  };

  const drainPendingMutations = (): void => {
    pendingMutations = [];
    cancelScheduledFlush();

    const observerMutations = observer?.takeRecords() ?? [];
    processMutationRecords(observerMutations, regex);
  };

  const initialScan = (): void => {
    if (!regex) {
      return;
    }

    skipCache = new WeakMap<Element, boolean>();
    scanSubtree(doc.body ?? doc, regex, skipCache, restorations);
  };

  const start = (): void => {
    if (doc.readyState === "loading") {
      doc.addEventListener(
        "DOMContentLoaded",
        () => {
          initialScan();
        },
        {
          once: true,
        }
      );
    } else {
      initialScan();
    }

    observer = new MutationObserver((mutations) => {
      processMutationRecords(mutations, regex);
      scheduleFlush(mutations);
    });
    observer.observe(doc.documentElement, {
      attributeFilter: [...SCANNABLE_ATTRS],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  };

  const stop = (): void => {
    drainPendingMutations();
    restoreDetachedWrappers(restorations);
    restoreDetachedSubtrees(restorations);
    observer?.disconnect();
    observer = null;
    pendingMutations = [];
  };

  const updateConfiguration = (): void => {
    drainPendingMutations();
    restoreDetachedWrappers(restorations);
    regex = buildRegex(emails, hideIpAddresses);
    reconcileDetachedSubtrees(restorations, regex);
    restoreTrackedContent(doc.documentElement ?? doc, restorations);

    if (observer && regex) {
      skipCache = new WeakMap<Element, boolean>();
      scanSubtree(doc.body ?? doc, regex, skipCache, restorations);

      if (doc.body !== null) {
        scanAttributes(doc.documentElement, regex, skipCache, restorations);
      }
    }
  };

  return {
    setEmails(nextEmails: string[]) {
      emails = nextEmails;
      updateConfiguration();
    },
    setHideIpAddresses(enabled: boolean) {
      hideIpAddresses = enabled;
      updateConfiguration();
    },
    start,
    stop,
  };
};

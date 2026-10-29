import { buildRegex } from "./redaction-address";
import {
  SCANNABLE_ATTRS,
  scanAttributes,
  scanMutation,
  scanSubtree,
} from "./redaction-scan";
import { createRestorations } from "./redaction-state";
import type { RedactorRestorations } from "./redaction-state";
import { tryReplaceText } from "./redaction-text";

export { isValidIpv6 } from "./redaction-address";

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

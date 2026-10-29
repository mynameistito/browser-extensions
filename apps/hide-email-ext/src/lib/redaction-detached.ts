import { restoreTrackedContent } from "./redaction-restoration";
import { scanSubtree } from "./redaction-scan";
import type { RedactorRestorations } from "./redaction-state";
import { tryReplaceText } from "./redaction-text";

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

/**
 * Reconcile a removed node with its document and current redaction policy.
 * @param node - Removed or moved node to process.
 * @param doc - Document observed by the redactor.
 * @param regex - Current matcher, or null when redaction is disabled.
 * @param restorations - Redactor restoration state.
 */
export const cleanupRemovedSubtree = (
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

/**
 * Reconcile wrappers and subtrees reinserted into the observed document.
 * @param node - Newly added node to inspect.
 * @param doc - Document observed by the redactor.
 * @param regex - Current matcher, or null when redaction is disabled.
 * @param restorations - Redactor restoration state.
 */
export const refreshReinsertedWrappers = (
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

/**
 * Restore detached toggle wrappers when they remain outside the document.
 * @param restorations - Redactor restoration state.
 */
export const restoreDetachedWrappers = (
  restorations: RedactorRestorations
): void => {
  for (const reference of restorations.detachedWrappers) {
    const wrapper = reference.deref();
    const shouldRestore = wrapper !== undefined && !wrapper.isConnected;

    if (shouldRestore && wrapper !== undefined) {
      restoreTrackedContent(wrapper, restorations);
    }

    restorations.detachedWrappers.delete(reference);
  }
};

/**
 * Restore tracked content in detached subtrees before stopping observation.
 * @param restorations - Redactor restoration state.
 */
export const restoreDetachedSubtrees = (
  restorations: RedactorRestorations
): void => {
  for (const reference of restorations.detachedSubtrees) {
    const root = reference.deref();

    if (root !== undefined && !root.isConnected) {
      restoreTrackedContent(root, restorations);
    }

    restorations.detachedSubtrees.delete(reference);
  }
};

/**
 * Reconcile detached subtrees with the latest address matcher.
 * @param restorations - Redactor restoration state.
 * @param regex - Current matcher, or null when redaction is disabled.
 */
export const reconcileDetachedSubtrees = (
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

import type { RedactorRestorations } from "./redaction-state";

/**
 * Remove collected wrapper references from the detached-wrapper registry.
 * @param references - Weak references to sweep.
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

/**
 * Restore all tracked text, attributes, and toggle wrappers in a subtree.
 * @param root - Subtree whose redactions should be restored.
 * @param restorations - Redactor restoration state.
 */
export const restoreTrackedContent = (
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

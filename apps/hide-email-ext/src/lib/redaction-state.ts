import type { ToggleRestoration } from "./redaction-toggle";

/** Original and redacted values tracked for a text node. */
export interface TextRestoration {
  readonly originalValue: string;
  readonly redactedValue: string;
}

/** Original and redacted values tracked for an element attribute. */
export interface AttributeRestoration {
  readonly originalValue: string;
  readonly redactedValue: string;
}

/** Per-document state required to restore content changed by redaction. */
export interface RedactorRestorations {
  readonly text: WeakMap<Text, TextRestoration>;
  readonly attributes: WeakMap<Element, Map<string, AttributeRestoration>>;
  readonly wrappers: WeakMap<HTMLElement, ToggleRestoration>;
  readonly detachedWrappers: Set<WeakRef<HTMLElement>>;
  readonly detachedSubtrees: Set<WeakRef<Node>>;
}

/**
 * Create empty restoration registries for one redactor instance.
 * @returns Empty state used to restore redacted content.
 */
export const createRestorations = (): RedactorRestorations => ({
  attributes: new WeakMap(),
  detachedSubtrees: new Set(),
  detachedWrappers: new Set(),
  text: new WeakMap(),
  wrappers: new WeakMap(),
});

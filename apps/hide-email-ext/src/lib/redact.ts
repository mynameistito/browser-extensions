import { REDACTION_TOKEN } from "./types";

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

const ADDRESS_HINT_RE = /[@.:0-9a-f]/iu;
const EMAIL_VISIBILITY_LABEL = "Toggle email visibility";
const BLUR_FILTER = "blur(4px)";
const FILTER_TRANSITION = "filter 150ms cubic-bezier(0.4, 0, 0.2, 1)";
const ARIA_PRESSED = "aria-pressed";
const HIDDEN_STATE = "false";
const VISIBLE_STATE = "true";
const REVEAL_TOOLTIP = "Click to reveal email";
const HIDE_TOOLTIP = "Click to hide email";

const IP_VISIBILITY_COPY = {
  hide: "Click to hide IP address",
  label: "Toggle IP address visibility",
  reveal: "Click to reveal IP address",
} as const;

const EMAIL_VISIBILITY_COPY = {
  hide: HIDE_TOOLTIP,
  label: EMAIL_VISIBILITY_LABEL,
  reveal: REVEAL_TOOLTIP,
} as const;

const TOOLTIP_PADDING = "2px 6px";
const TOOLTIP_HOVER_DELAY_MS = 500;
const RANDOM_EMAIL_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_IPV6_CHARS = "0123456789abcdef";
const IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_PATTERN = `(?<![\\w.:])${IPV4_OCTET}(?:\\.${IPV4_OCTET}){3}(?![\\w.:])`;

const IPV6_CANDIDATE_PATTERN =
  "(?<![\\w:])(?:(?:[a-f\\d]{1,4}:){2,7}[a-f\\d]{1,4}|(?:[a-f\\d]{1,4}:){1,7}:|(?:[a-f\\d]{1,4}:){1,6}:(?:[a-f\\d]{1,4}(?::[a-f\\d]{1,4}){0,5})?|::(?:[a-f\\d]{1,4}(?::[a-f\\d]{1,4}){0,6})?)(?![\\w:.])";

interface TextRestoration {
  readonly originalValue: string;
  readonly redactedValue: string;
}

interface AttributeRestoration {
  readonly originalValue: string;
  readonly redactedValue: string;
}

interface WrapperRestoration {
  readonly isRestorable: () => boolean;
  readonly restore: () => boolean;
  readonly restoreGroup?: () => boolean;
  readonly dispose: () => void;
  readonly cancelPendingHover: () => void;
  readonly detached: boolean;
  readonly detachedReference: WeakRef<HTMLElement> | null;
}

interface RedactorRestorations {
  readonly text: WeakMap<Text, TextRestoration>;
  readonly attributes: WeakMap<Element, Map<string, AttributeRestoration>>;
  readonly wrappers: WeakMap<HTMLElement, WrapperRestoration>;
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

const createRandomEmailPart = (length: number): string => {
  const randomValues = globalThis.crypto.getRandomValues(
    new Uint8Array(length)
  );

  return Array.from(randomValues, (value) =>
    RANDOM_EMAIL_CHARS.charAt(value % RANDOM_EMAIL_CHARS.length)
  ).join("");
};

const createDecoyEmail = (): string =>
  `${createRandomEmailPart(8)}@${createRandomEmailPart(7)}.tld`;

const createRandomIpv4Octet = (): string =>
  String(globalThis.crypto.getRandomValues(new Uint8Array(1))[0] ?? 0);

const createDecoyIpv4 = (): string =>
  Array.from({ length: 4 }, createRandomIpv4Octet).join(".");

const createDecoyIpv6 = (): string => {
  const randomValues = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const groups: string[] = [];

  for (let index = 0; index < randomValues.length; index += 4) {
    const digits = randomValues.slice(index, index + 4);
    groups.push(
      Array.from(digits, (value) =>
        RANDOM_IPV6_CHARS.charAt(value % RANDOM_IPV6_CHARS.length)
      ).join("")
    );
  }

  return groups.join(":");
};

const isValidIpv6 = (value: string): boolean => {
  const halves = value.split("::");

  if (halves.length > 2) {
    return false;
  }

  const left = halves[0] ?? "";
  const right = halves[1] ?? "";

  const groups = [
    ...left.split(":").filter(Boolean),
    ...right.split(":").filter(Boolean),
  ];

  if (!groups.every((group) => /^[a-f\d]{1,4}$/iu.test(group))) {
    return false;
  }

  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
};

const isValidMatch = (value: string): boolean =>
  !value.includes(":") || isValidIpv6(value);

const createDecoy = (value: string): string => {
  if (value.includes(".")) {
    return createDecoyIpv4();
  }

  if (value.includes(":")) {
    return createDecoyIpv6();
  }

  return createDecoyEmail();
};

const replaceMatches = (value: string, regex: RegExp): string =>
  value.replaceAll(regex, (match) =>
    isValidMatch(match) ? REDACTION_TOKEN : match
  );

const escapeRegex = (str: string): string =>
  str.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const buildRegex = (
  emails: string[],
  hideIpAddresses: boolean
): RegExp | null => {
  const pattern = emails.map((e) => escapeRegex(e)).join("|");

  const addressPatterns = hideIpAddresses
    ? [IPV6_CANDIDATE_PATTERN, IPV4_PATTERN]
    : [];

  const expressions = [...addressPatterns, pattern].filter(Boolean);

  if (expressions.length === 0) {
    return null;
  }

  return new RegExp(expressions.join("|"), "giu");
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

    const visibilityCopy = matchedText.includes("@")
      ? EMAIL_VISIBILITY_COPY
      : IP_VISIBILITY_COPY;

    const decoyEmail = createDecoy(matchedText);
    fragment.append(
      text.ownerDocument.createTextNode(
        originalValue.slice(cursor, match.index)
      )
    );

    const wrapper = text.ownerDocument.createElement("span");
    wrappers.push(wrapper);
    wrapper.dataset.redacted = "toggle-container";
    wrapper.style.display = "inline-block";
    wrapper.style.position = "relative";

    const toggle = text.ownerDocument.createElement("span");
    toggle.textContent = decoyEmail;
    toggle.dataset.redacted = "toggle";
    toggle.setAttribute(ARIA_LABEL, visibilityCopy.label);
    toggle.setAttribute("aria-description", visibilityCopy.reveal);
    toggle.setAttribute(ARIA_PRESSED, HIDDEN_STATE);
    toggle.setAttribute("role", "button");
    toggle.tabIndex = 0;
    toggle.style.cursor = "pointer";
    toggle.style.filter = BLUR_FILTER;
    toggle.style.transition = FILTER_TRANSITION;

    const tooltip = text.ownerDocument.createElement("span");
    tooltip.textContent = visibilityCopy.reveal;
    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("aria-hidden", VISIBLE_STATE);
    tooltip.style.position = "absolute";
    tooltip.style.bottom = "calc(100% + 6px)";
    tooltip.style.left = "50%";
    tooltip.style.transform = "translateX(-50%)";
    tooltip.style.zIndex = "2147483647";
    tooltip.style.display = "none";
    tooltip.style.padding = TOOLTIP_PADDING;
    tooltip.style.border = "1px solid rgba(255, 255, 255, 0.12)";
    tooltip.style.borderRadius = "999px";
    tooltip.style.backgroundColor = "#222";
    tooltip.style.color = "#fff";
    tooltip.style.fontFamily = "inherit";
    tooltip.style.fontSize = "12px";
    tooltip.style.fontWeight = "500";
    tooltip.style.lineHeight = "1.2";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.style.pointerEvents = "none";
    tooltip.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.25)";

    const setTooltipVisibility = (visible: boolean): void => {
      tooltip.style.display = visible ? "block" : "none";
      tooltip.setAttribute("aria-hidden", String(!visible));
    };

    let isHovered = false;
    let isFocused = false;
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearHoverTimeout = (): void => {
      if (hoverTimeout !== null) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
    };

    const scheduleHoverTooltip = (): void => {
      setTooltipVisibility(false);
      clearHoverTimeout();
      hoverTimeout = setTimeout(() => {
        hoverTimeout = null;

        if (isHovered && !isFocused) {
          setTooltipVisibility(true);
        }
      }, TOOLTIP_HOVER_DELAY_MS);
    };

    const onMouseEnter = (): void => {
      isHovered = true;

      if (!isFocused) {
        scheduleHoverTooltip();
      }
    };

    const onMouseLeave = (): void => {
      isHovered = false;
      clearHoverTimeout();

      if (!isFocused) {
        setTooltipVisibility(false);
      }
    };

    const onFocus = (): void => {
      isFocused = true;
      clearHoverTimeout();
      setTooltipVisibility(true);
    };

    const onBlur = (): void => {
      isFocused = false;

      if (isHovered) {
        scheduleHoverTooltip();
      } else {
        setTooltipVisibility(false);
      }
    };

    const toggleVisibility = (): void => {
      const isHidden = toggle.getAttribute(ARIA_PRESSED) === HIDDEN_STATE;
      clearHoverTimeout();
      setTooltipVisibility(false);
      toggle.setAttribute(
        ARIA_PRESSED,
        isHidden ? VISIBLE_STATE : HIDDEN_STATE
      );
      toggle.setAttribute(
        ARIA_LABEL,
        isHidden ? matchedText : visibilityCopy.label
      );
      const hint = isHidden ? visibilityCopy.hide : visibilityCopy.reveal;
      tooltip.textContent = hint;
      toggle.setAttribute("aria-description", hint);
      toggle.style.filter = isHidden ? "none" : BLUR_FILTER;
      toggle.textContent = isHidden ? matchedText : decoyEmail;
    };

    const onClick = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      toggleVisibility();
    };

    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleVisibility();
      }
    };

    toggle.addEventListener("mouseenter", onMouseEnter);
    toggle.addEventListener("mouseleave", onMouseLeave);
    toggle.addEventListener("focus", onFocus);
    toggle.addEventListener("blur", onBlur);
    toggle.addEventListener("click", onClick);
    toggle.addEventListener("keydown", onKeydown);

    wrapper.append(toggle, tooltip);
    fragment.append(wrapper);

    const dispose = (): void => {
      clearHoverTimeout();
      toggle.removeEventListener("mouseenter", onMouseEnter);
      toggle.removeEventListener("mouseleave", onMouseLeave);
      toggle.removeEventListener("focus", onFocus);
      toggle.removeEventListener("blur", onBlur);
      toggle.removeEventListener("click", onClick);
      toggle.removeEventListener("keydown", onKeydown);
    };

    const isRestorable = (): boolean => {
      if (wrapper.childNodes.length !== 2) {
        return false;
      }

      if (wrapper.firstChild !== toggle || wrapper.lastChild !== tooltip) {
        return false;
      }

      return (
        toggle.textContent === decoyEmail || toggle.textContent === matchedText
      );
    };

    restorations.wrappers.set(wrapper, {
      cancelPendingHover: clearHoverTimeout,
      detached: false,
      detachedReference: null,
      dispose,
      isRestorable,
      restore: () => {
        dispose();

        if (!isRestorable()) {
          return false;
        }

        const originalText = wrapper.ownerDocument.createTextNode(matchedText);

        if (wrapper.parentNode === null) {
          wrapper.replaceChildren(originalText);
          delete wrapper.dataset.redacted;
          wrapper.removeAttribute("style");
        } else {
          wrapper.replaceWith(originalText);
        }

        return true;
      },
    });
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

      if (!hasRestorableGeneratedText(generatedText)) {
        return false;
      }

      if (!areGeneratedNodesContiguous(liveNodes, parent)) {
        return false;
      }

      if (!areWrappersRestorable(wrappers, parent, restorations)) {
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
    regex.test(combined) &&
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

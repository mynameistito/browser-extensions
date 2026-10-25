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

const EMAIL_HINT_RE = /[@.]/u;
const EMAIL_VISIBILITY_LABEL = "Toggle email visibility";
const BLUR_FILTER = "blur(4px)";
const FILTER_TRANSITION = "filter 150ms cubic-bezier(0.4, 0, 0.2, 1)";
const ARIA_PRESSED = "aria-pressed";
const HIDDEN_STATE = "false";
const VISIBLE_STATE = "true";
const REVEAL_TOOLTIP = "Click to reveal email";
const HIDE_TOOLTIP = "Click to hide email";
const TOOLTIP_PADDING = "2px 6px";
const TOOLTIP_HOVER_DELAY_MS = 500;
const RANDOM_EMAIL_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

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
  readonly restore: () => void;
  readonly restoreGroup?: () => boolean;
  readonly dispose: () => void;
}

interface RedactorRestorations {
  readonly text: WeakMap<Text, TextRestoration>;
  readonly attributes: WeakMap<Element, Map<string, AttributeRestoration>>;
  readonly wrappers: WeakMap<HTMLElement, WrapperRestoration>;
}

const createRestorations = (): RedactorRestorations => ({
  attributes: new WeakMap(),
  text: new WeakMap(),
  wrappers: new WeakMap(),
});

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

const escapeRegex = (str: string): string =>
  str.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const buildRegex = (emails: string[]): RegExp | null => {
  if (emails.length === 0) {
    return null;
  }

  const pattern = emails.map((e) => escapeRegex(e)).join("|");

  return new RegExp(pattern, "giu");
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

  if (!EMAIL_HINT_RE.test(text.nodeValue)) {
    return;
  }

  regex.lastIndex = 0;

  const link = text.parentElement?.closest("a[href]");

  if (link !== null && link !== undefined) {
    const originalValue = text.nodeValue;
    const redactedValue = originalValue.replaceAll(regex, REDACTION_TOKEN);

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

  const fragment = text.ownerDocument.createDocumentFragment();
  const wrappers: HTMLElement[] = [];
  let cursor = 0;
  let matched = false;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text.nodeValue)) !== null) {
    matched = true;
    const matchEnd = regex.lastIndex;
    const matchedText = text.nodeValue.slice(match.index, matchEnd);
    const decoyEmail = createDecoyEmail();
    fragment.append(
      text.ownerDocument.createTextNode(
        text.nodeValue.slice(cursor, match.index)
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
    toggle.setAttribute(ARIA_LABEL, EMAIL_VISIBILITY_LABEL);
    toggle.setAttribute("aria-description", REVEAL_TOOLTIP);
    toggle.setAttribute(ARIA_PRESSED, HIDDEN_STATE);
    toggle.setAttribute("role", "button");
    toggle.tabIndex = 0;
    toggle.style.cursor = "pointer";
    toggle.style.filter = BLUR_FILTER;
    toggle.style.transition = FILTER_TRANSITION;

    const tooltip = text.ownerDocument.createElement("span");
    tooltip.textContent = REVEAL_TOOLTIP;
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
        isHidden ? matchedText : EMAIL_VISIBILITY_LABEL
      );
      const hint = isHidden ? HIDE_TOOLTIP : REVEAL_TOOLTIP;
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
      if (wrapper.parentNode === null || wrapper.childNodes.length !== 2) {
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
      dispose,
      isRestorable,
      restore: () => {
        dispose();

        if (!isRestorable()) {
          return;
        }

        wrapper.replaceWith(wrapper.ownerDocument.createTextNode(matchedText));
      },
    });
    cursor = matchEnd;
  }

  if (matched) {
    fragment.append(
      text.ownerDocument.createTextNode(text.nodeValue.slice(cursor))
    );

    const generatedNodes = [...fragment.childNodes];

    const generatedText = new Map<Text, string>();

    for (const node of generatedNodes) {
      if (node instanceof Text) {
        generatedText.set(node, node.nodeValue ?? "");
      }
    }

    const restoreOriginalText = (): boolean => {
      const parent = generatedNodes[0]?.parentNode;

      if (
        parent === null ||
        generatedNodes.some((node) => node.parentNode !== parent)
      ) {
        return false;
      }

      for (let index = 1; index < generatedNodes.length; index += 1) {
        if (generatedNodes[index - 1]?.nextSibling !== generatedNodes[index]) {
          return false;
        }
      }

      for (const [node, value] of generatedText) {
        if (node.nodeValue === null || node.nodeValue !== value) {
          return false;
        }
      }

      for (const wrapper of wrappers) {
        const restoration = restorations.wrappers.get(wrapper);

        if (restoration === undefined || !restoration.isRestorable()) {
          return false;
        }
      }

      const [firstNode] = generatedNodes;

      if (firstNode === undefined) {
        return false;
      }

      for (const wrapper of wrappers) {
        restorations.wrappers.get(wrapper)?.dispose();
        restorations.wrappers.delete(wrapper);
      }

      firstNode.before(text);

      for (const node of generatedNodes) {
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

    if (value === null || value.length === 0 || !EMAIL_HINT_RE.test(value)) {
      continue;
    }

    regex.lastIndex = 0;
    const replaced = value.replaceAll(regex, REDACTION_TOKEN);

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

const scanSubtree = (
  root: Node,
  regex: RegExp,
  skipCache: WeakMap<Element, boolean>,
  restorations: RedactorRestorations
): void => {
  for (const child of root.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child instanceof Text) {
      tryReplaceText(child, regex, skipCache, restorations);
    }
  }

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

  if (wrapper.restoreGroup === undefined || !wrapper.restoreGroup()) {
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

  let child = root.firstChild;

  while (child !== null) {
    const { nextSibling } = child;
    restoreTrackedContent(child, restorations);
    child = nextSibling;
  }
};

const cleanupRemovedSubtree = (
  node: Node,
  doc: Document,
  regex: RegExp | null,
  restorations: RedactorRestorations
): void => {
  const wasReinserted = doc.documentElement.contains(node);
  restoreTrackedContent(node, restorations);

  if (wasReinserted && regex) {
    scanSubtree(node, regex, new WeakMap(), restorations);
  }
};

/** Controls the email redaction observer. */
export interface Redactor {
  /** Replace the email list used by the redactor. */
  setEmails: (emails: string[]) => void;
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
  let observer: MutationObserver | null = null;
  let scheduled = false;
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingIdle: number | null = null;
  let pendingMutations: MutationRecord[] = [];
  let skipCache = new WeakMap<Element, boolean>();
  const restorations = createRestorations();

  const flush = (mutations?: MutationRecord[]): void => {
    skipCache = new WeakMap<Element, boolean>();

    if (!regex) {
      return;
    }

    if (mutations === undefined) {
      scanSubtree(doc.body ?? doc, regex, skipCache, restorations);
    } else {
      for (const mutation of mutations) {
        scanMutation(mutation, regex, skipCache, restorations);
      }
    }
  };

  const scheduleFlush = (mutations?: MutationRecord[]): void => {
    if (mutations) {
      pendingMutations.push(...mutations);
    }

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
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          cleanupRemovedSubtree(node, doc, regex, restorations);
        }
      }

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
    observer?.disconnect();
    observer = null;

    if (pendingTimeout !== null) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }

    if (pendingIdle !== null) {
      cancelIdleCallback(pendingIdle);
      pendingIdle = null;
    }

    scheduled = false;
    pendingMutations = [];
  };

  return {
    setEmails(emails: string[]) {
      restoreTrackedContent(doc.documentElement ?? doc, restorations);
      regex = buildRegex(emails);

      if (observer) {
        skipCache = new WeakMap<Element, boolean>();

        if (regex) {
          scanSubtree(doc.documentElement, regex, skipCache, restorations);
        }
      }
    },
    start,
    stop,
  };
};

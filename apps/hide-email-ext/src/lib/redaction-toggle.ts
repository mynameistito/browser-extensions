import { createDecoy } from "./redaction-address";
import type { AddressKind } from "./redaction-address";

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
const ARIA_LABEL = "aria-label";

/** State and cleanup operations for a redaction toggle. */
export interface ToggleRestoration {
  /** Whether the page has left the generated wrapper intact. */
  readonly isRestorable: () => boolean;
  /** Restore the original address within the wrapper. */
  readonly restore: () => boolean;
  /** Restore the complete generated text run, when available. */
  readonly restoreGroup?: () => boolean;
  /** Remove the toggle's listeners and timers. */
  readonly dispose: () => void;
  /** Cancel a delayed tooltip. */
  readonly cancelPendingHover: () => void;
  /** Whether the wrapper is detached from the observed document. */
  readonly detached: boolean;
  /** Weak reference used to track detached wrappers. */
  readonly detachedReference: WeakRef<HTMLElement> | null;
}

/** DOM wrapper and lifecycle state for one redacted address. */
export interface RedactionToggle {
  /** Element inserted where the original address appeared. */
  readonly wrapper: HTMLElement;
  /** Cleanup and restoration operations for the wrapper. */
  readonly restoration: ToggleRestoration;
}

/**
 * Create the accessible, reversible toggle shown for a redacted address.
 * @param ownerDocument - Document that will own the toggle nodes.
 * @param matchedText - Original address represented by the toggle.
 * @param addressKind - Address kind used for label and decoy generation.
 * @param isLinked - Whether the address is inside a navigable link.
 * @returns Toggle markup and its cleanup/restoration state.
 */
export const createRedactionToggle = (
  ownerDocument: Document,
  matchedText: string,
  addressKind: AddressKind,
  isLinked: boolean
): RedactionToggle => {
  const visibilityCopy =
    addressKind === "email" ? EMAIL_VISIBILITY_COPY : IP_VISIBILITY_COPY;

  const decoyAddress = createDecoy(addressKind);
  const wrapper = ownerDocument.createElement("span");
  wrapper.dataset.redacted = "toggle-container";
  wrapper.style.display = "inline-block";
  wrapper.style.position = "relative";

  const toggle = ownerDocument.createElement("span");
  toggle.textContent = decoyAddress;
  toggle.dataset.redacted = "toggle";
  toggle.setAttribute(ARIA_LABEL, visibilityCopy.label);
  toggle.setAttribute("aria-description", visibilityCopy.reveal);
  toggle.setAttribute(ARIA_PRESSED, HIDDEN_STATE);
  toggle.setAttribute("role", "button");
  toggle.tabIndex = 0;
  toggle.style.cursor = "pointer";
  toggle.style.filter = BLUR_FILTER;
  toggle.style.transition = FILTER_TRANSITION;

  const tooltip = ownerDocument.createElement("span");
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
    toggle.setAttribute(ARIA_PRESSED, isHidden ? VISIBLE_STATE : HIDDEN_STATE);
    toggle.setAttribute(
      ARIA_LABEL,
      isHidden ? matchedText : visibilityCopy.label
    );
    const hint = isHidden ? visibilityCopy.hide : visibilityCopy.reveal;
    tooltip.textContent = hint;
    toggle.setAttribute("aria-description", hint);
    toggle.style.filter = isHidden ? "none" : BLUR_FILTER;
    toggle.textContent = isHidden ? matchedText : decoyAddress;
  };

  const onClick = (event: MouseEvent): void => {
    const isHidden = toggle.getAttribute(ARIA_PRESSED) === HIDDEN_STATE;

    if (!isHidden && isLinked) {
      return;
    }

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
      toggle.textContent === decoyAddress || toggle.textContent === matchedText
    );
  };

  const restoration: ToggleRestoration = {
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

      const originalText = ownerDocument.createTextNode(matchedText);

      if (wrapper.parentNode === null) {
        wrapper.replaceChildren(originalText);
        delete wrapper.dataset.redacted;
        wrapper.removeAttribute("style");
      } else {
        wrapper.replaceWith(originalText);
      }

      return true;
    },
  };

  return { restoration, wrapper };
};

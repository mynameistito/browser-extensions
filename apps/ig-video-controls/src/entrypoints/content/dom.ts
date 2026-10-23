/**
 * Delay calls to a function until its latest invocation settles.
 * @param fn - Function to debounce.
 * @param delayMs - Delay in milliseconds.
 * @returns A debounced version of the function.
 */
export const debounce = <T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number
): ((...args: Parameters<T>) => void) => {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timerId !== null) {
      clearTimeout(timerId);
    }

    timerId = setTimeout(() => {
      timerId = null;
      fn(...args);
    }, delayMs);
  };
};

type ThrottledFn<TArguments extends readonly unknown[], TResult> = (
  ...args: TArguments
) => TResult | undefined;

/**
 * Limit how often a function can run, with optional leading and trailing calls.
 * @param fn - Function to throttle.
 * @param minMs - Minimum interval between calls in milliseconds.
 * @param options - Controls leading and trailing calls.
 * @returns A throttled version of the function.
 */
export const throttle = <TArguments extends readonly unknown[], TResult>(
  fn: (...args: TArguments) => TResult,
  minMs: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): ThrottledFn<TArguments, TResult> => {
  let pendingArgs: TArguments | null = null;
  let result: TResult | undefined;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let previous = 0;

  const invokeFn = (args: TArguments): void => {
    result = fn(...args);
  };

  const later = () => {
    previous = options.leading === false ? 0 : Date.now();
    timeout = null;

    if (pendingArgs !== null) {
      invokeFn(pendingArgs);
    }

    pendingArgs = null;
  };

  return function throttled(...innerArgs: TArguments): TResult | undefined {
    const now = Date.now();

    if (previous === 0 && options.leading === false) {
      previous = now;
    }

    const remaining = minMs - (now - previous);
    pendingArgs = innerArgs;

    if (remaining <= 0 || remaining > minMs) {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }

      previous = now;
      invokeFn(pendingArgs);

      pendingArgs = null;
    } else if (timeout === null && options.trailing !== false) {
      timeout = setTimeout(later, remaining);
    }

    return result;
  };
};

/**
 * Find one element matching a selector.
 * @param selector - CSS selector to query.
 * @param context - Root used for the query, defaulting to the document.
 * @returns The matching element, or null when there is no match.
 */
export const query = (selector: string, context?: Element | Document | null) =>
  (context ?? document).querySelector(selector);

/**
 * Find all elements matching a selector.
 * @param selector - CSS selector to query.
 * @param context - Root used for the query, defaulting to the document.
 * @returns Matching elements in document order.
 */
export const queryAll = (
  selector: string,
  context?: Element | Document | null
): Element[] => [...(context ?? document).querySelectorAll(selector)];

/**
 * Parse an HTML fragment and return its first element.
 * @param html - HTML fragment to parse.
 * @returns The first element, or null when the fragment has none.
 */
export const fromHtml = (html: string): Element | null => {
  const parsedDocument = new DOMParser().parseFromString(html, "text/html");

  return parsedDocument.body.firstElementChild;
};

/**
 * Compare two numbers after truncating them to a fixed decimal precision.
 * @param a - First number.
 * @param b - Second number.
 * @param decimalPlaces - Number of decimal places to retain.
 * @returns Negative, zero, or positive according to the comparison.
 */
export const cmpToPrecision = (
  a: number,
  b: number,
  decimalPlaces: number
): number => {
  const pow = 10 ** decimalPlaces;

  return Math.trunc(a * pow) - Math.trunc(b * pow);
};

/**
 * Get every element child of the given element's parent.
 * @param element - Element whose siblings should be returned.
 * @returns The parent's element children.
 */
export const getAllChildrenOfParent = (element: Element): Element[] => {
  const siblings: Element[] = [];
  let cursor = element.parentNode?.firstElementChild ?? null;

  while (cursor) {
    siblings.push(cursor);
    cursor = cursor.nextElementSibling;
  }

  return siblings;
};

/**
 * Hide an HTML element by changing its visibility.
 * @param el - Element to hide.
 */
export const hide = (el: Element | null | undefined): void => {
  if (el instanceof HTMLElement) {
    el.style.visibility = "hidden";
  }
};

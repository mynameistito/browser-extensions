export const debounce = <T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number
): ((...args: Parameters<T>) => void) => {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>) => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      timerId = undefined;
      fn(...args);
    }, delayMs);
  };
};

type ThrottledFn<T extends (...args: unknown[]) => unknown> = (
  ...args: Parameters<T>
) => ReturnType<T> | undefined;

export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  minMs: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): ThrottledFn<T> => {
  let pendingArgs: Parameters<T> | null = null;
  let result: ReturnType<T> | undefined;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let previous = 0;

  const invokeFn = (args: Parameters<T>): void => {
    result = fn(...args) as ReturnType<T> | undefined;
  };

  const later = () => {
    previous = options.leading === false ? 0 : Date.now();
    timeout = null;
    if (pendingArgs) {
      invokeFn(pendingArgs);
    }
    pendingArgs = null;
  };

  const throttled = function throttled(
    ...innerArgs: Parameters<T>
  ): ReturnType<T> | undefined {
    const now = Date.now();
    if (!previous && options.leading === false) {
      previous = now;
    }
    const remaining = minMs - (now - previous);
    pendingArgs = innerArgs;

    if (remaining <= 0 || remaining > minMs) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      invokeFn(pendingArgs);
      if (!timeout) {
        pendingArgs = null;
      }
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining);
    }

    return result;
  };

  return throttled;
};

export const query = (selector: string, context?: Element | Document | null) =>
  (context ?? document).querySelector(selector);

export const queryAll = (
  selector: string,
  context?: Element | Document | null
): Element[] => [...(context ?? document).querySelectorAll(selector)];

export const fromHtml = (html: string): Element | null => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.firstElementChild;
};

export const cmpToPrecision = (
  a: number,
  b: number,
  decimalPlaces: number
): number => {
  const pow = 10 ** decimalPlaces;
  return Math.trunc(a * pow) - Math.trunc(b * pow);
};

export const getAllChildrenOfParent = (element: Element): Element[] => {
  const siblings: Element[] = [];
  let cursor = element.parentNode?.firstElementChild ?? null;
  while (cursor) {
    siblings.push(cursor);
    cursor = cursor.nextElementSibling;
  }
  return siblings;
};

export const hide = (el: Element | null | undefined): void => {
  if (el instanceof HTMLElement) {
    el.style.visibility = "hidden";
  }
};

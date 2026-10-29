import { afterEach, beforeEach, vi } from "vitest";

import { DEFAULTS } from "@/lib/defaults";

/** Asserts that a fixture element is an HTML element.
 *
 * @param element - The fixture element to check.
 * @returns The element narrowed to `HTMLElement`.
 */
export const requireHtmlElement = (element: Element | null): HTMLElement => {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError("Expected an HTML element in the test fixture");
  }

  return element;
};

/** Asserts that a fixture element exists.
 *
 * @param element - The fixture element to check.
 * @returns The non-null fixture element.
 */
export const requireElement = <T extends Element>(element: T | null): T => {
  if (!element) {
    throw new TypeError("Expected an element in the test fixture");
  }

  return element;
};

/** Returns a fresh copy of the default extension settings.
 *
 * @returns A fresh settings object.
 */
export const settings = (): typeof DEFAULTS => ({ ...DEFAULTS });

/** Creates a DOMRect with the supplied dimensions and position.
 *
 * @param width - The rectangle width.
 * @param height - The rectangle height.
 * @param top - The rectangle top offset.
 * @param left - The rectangle left offset.
 * @returns The constructed DOM rectangle.
 */
export const rect = (
  width: number,
  height: number,
  top = 0,
  left = 0
): DOMRect => new DOMRect(left, top, width, height);

/** Stubs an element's measured bounds for layout tests.
 *
 * @param element - The element whose bounds are stubbed.
 * @param value - The rectangle returned by the element.
 * @returns The spy installed on `getBoundingClientRect`.
 */
export const setRect = (element: Element, value: DOMRect) =>
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(value);

/** Replaces an element's children with parsed HTML fixture content.
 *
 * @param target - The element whose children are replaced.
 * @param markup - The HTML fixture content.
 * @returns Nothing.
 */
export const setMarkup = (target: Element, markup: string): void => {
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  target.replaceChildren(...parsed.body.childNodes);
};

/** Appends a video fixture with stable layout dimensions.
 *
 * @param parent - The parent that receives the video.
 * @returns The appended video element.
 */
export const makeVideo = (
  parent: Element = document.body
): HTMLVideoElement => {
  const video = document.createElement("video");
  parent.append(video);
  setRect(video, rect(300, 600));

  return video;
};

/** Installs common browser storage mocks and per-test DOM cleanup.
 *
 * @returns The mocks used by storage and entrypoint behavior tests.
 */
export const setupTestEnvironment = () => {
  const storageGet = vi.fn<
    (values: typeof DEFAULTS) => Promise<Partial<typeof DEFAULTS>>
  >(async (values) => await Promise.resolve(values));

  const storageSet = vi.fn<(values: Partial<typeof DEFAULTS>) => Promise<void>>(
    async () => {}
  );

  const addStorageListener = vi.fn<
    (
      listener: (
        changes: Record<string, Browser.storage.StorageChange>,
        areaName?: string
      ) => void
    ) => void
  >(() => {});

  const removeStorageListener = vi.fn<() => void>(() => {});

  beforeEach(() => {
    vi.clearAllMocks();

    setMarkup(document.body, "");
    history.replaceState(null, "", "/");

    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: storageGet,
          set: storageSet,
        },
        onChanged: {
          addListener: addStorageListener,
          removeListener: removeStorageListener,
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  return { addStorageListener, removeStorageListener, storageGet, storageSet };
};

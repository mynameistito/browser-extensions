/**
 * Return the page mount target or fail with a clear extension-page error.
 * @param root - Element queried from the extension page.
 * @returns The required root element.
 */
export const requireNewTabRoot = (
  root: HTMLDivElement | null
): HTMLDivElement => {
  if (!root) {
    throw new Error("The new-tab root element is missing.");
  }

  return root;
};

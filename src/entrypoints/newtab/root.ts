/** Return the page mount target or fail with a clear extension-page error. */
export const requireNewTabRoot = (
  root: HTMLDivElement | null
): HTMLDivElement => {
  if (!root) {
    throw new Error("The new-tab root element is missing.");
  }

  return root;
};

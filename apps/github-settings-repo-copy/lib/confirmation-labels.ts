import { createCopyButton } from "./copy-button";

const COPYABLE_ATTRIBUTE = "data-repocopy-confirmation-name";
const CONFIRMATION_PREFIX = "To confirm, type";

const makeLabelCopyable = (
  label: HTMLLabelElement,
  repositoryName: string
): void => {
  if (
    label.querySelector(`[${COPYABLE_ATTRIBUTE}]`) ||
    !label.textContent.trim().startsWith(CONFIRMATION_PREFIX)
  ) {
    return;
  }

  const walker = document.createTreeWalker(label, NodeFilter.SHOW_ALL);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;

    if (node instanceof Text) {
      textNodes.push(node);
    }
  }

  const textNode = textNodes.find((node) =>
    (node.nodeValue ?? "").includes(repositoryName)
  );

  if (textNode === undefined) {
    return;
  }

  const nameStart = textNode.data.indexOf(repositoryName);
  const hasOpeningQuote = /["'“‘]$/u.test(textNode.data.slice(0, nameStart));

  const hasClosingQuote = /^["'”’]/u.test(
    textNode.data.slice(nameStart + repositoryName.length)
  );

  const nameAndAfter = textNode.splitText(nameStart - Number(hasOpeningQuote));

  if (hasOpeningQuote) {
    nameAndAfter.data = nameAndAfter.data.slice(1);
  }

  const afterName = nameAndAfter.splitText(repositoryName.length);

  if (hasClosingQuote) {
    afterName.data = afterName.data.slice(1);
  }

  const button = createCopyButton(repositoryName);
  button.setAttribute(COPYABLE_ATTRIBUTE, "");
  nameAndAfter.nodeValue = "";
  nameAndAfter.parentNode?.insertBefore(button, afterName);
};

/**
 * Enhances matching GitHub repository confirmation labels inside a root.
 * @param root - DOM subtree to scan.
 * @param repositoryName - The owner/repository value expected in the label.
 */
export const enhanceConfirmationLabels = (
  root: ParentNode,
  repositoryName: string
): void => {
  const labels = root.querySelectorAll<HTMLLabelElement>(
    'dialog label, [role="dialog"] label, label.FormControl-label'
  );

  for (const label of labels) {
    makeLabelCopyable(label, repositoryName);
  }
};

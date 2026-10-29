const copyWithExecCommand = (text: string, target: Document): boolean => {
  // eslint-disable-next-line typescript/no-deprecated -- Detects support for the legacy fallback.
  if (target.body === null || target.execCommand === undefined) {
    return false;
  }

  const textarea = target.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  target.body.append(textarea);
  const focusedElement = target.activeElement;

  try {
    textarea.select();

    // eslint-disable-next-line typescript/no-deprecated -- Fallback when the modern Clipboard API fails.
    return target.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();

    if (focusedElement instanceof HTMLElement) {
      focusedElement.focus();
    }
  }
};

/**
 * Copies text through the Clipboard API with a legacy browser fallback.
 * @param text - Text to copy.
 * @returns Whether either clipboard mechanism copied the text.
 */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);

    return true;
  } catch {
    return copyWithExecCommand(text, document);
  }
};

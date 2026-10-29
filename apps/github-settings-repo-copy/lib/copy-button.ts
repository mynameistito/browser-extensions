import { copyTextToClipboard } from "./clipboard";

const ARIA_LABEL_ATTRIBUTE = "aria-label";
const iconResetTimers = new WeakMap<HTMLButtonElement, number>();

const createIcon = (kind: "check" | "copy"): SVGSVGElement => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute(
    "d",
    kind === "check"
      ? "m3.5 8.5 3 3 6-7"
      : "M5.5 5.5h6.75a1 1 0 0 1 1 1v6.75a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Zm-1.75 7h-.5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v.5"
  );
  svg.append(path);

  return svg;
};

const reportCopyResult = (button: HTMLButtonElement, name: string): void => {
  button.setAttribute(ARIA_LABEL_ATTRIBUTE, `Copied ${name}`);
  button.classList.add("repocopy-copied");
  button.querySelector("svg")?.replaceWith(createIcon("check"));

  const previousTimer = iconResetTimers.get(button);

  if (previousTimer !== undefined) {
    window.clearTimeout(previousTimer);
  }

  const resetTimer = window.setTimeout(() => {
    button.setAttribute(ARIA_LABEL_ATTRIBUTE, `Copy ${name}`);
    button.classList.remove("repocopy-copied");
    button.querySelector("svg")?.replaceWith(createIcon("copy"));
    iconResetTimers.delete(button);
  }, 1400);

  iconResetTimers.set(button, resetTimer);
};

const reportCopyFailure = (button: HTMLButtonElement, name: string): void => {
  button.setAttribute(ARIA_LABEL_ATTRIBUTE, `Could not copy ${name}`);

  window.setTimeout(() => {
    button.setAttribute(ARIA_LABEL_ATTRIBUTE, `Copy ${name}`);
  }, 1400);
};

const copyButtonContent = async (
  button: HTMLButtonElement,
  name: string
): Promise<void> => {
  const copied = await copyTextToClipboard(name);

  if (copied) {
    reportCopyResult(button, name);
  } else {
    reportCopyFailure(button, name);
  }
};

/**
 * Creates a button whose accessible feedback reflects the clipboard result.
 * @param repositoryName - The owner/repository value to copy.
 * @returns A button ready to insert into a confirmation label.
 */
export const createCopyButton = (repositoryName: string): HTMLButtonElement => {
  const button = document.createElement("button");
  const code = document.createElement("code");
  code.textContent = repositoryName;
  button.append(code, createIcon("copy"));
  button.className = "repocopy-inline-code";
  button.setAttribute(ARIA_LABEL_ATTRIBUTE, `Copy ${repositoryName}`);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void copyButtonContent(button, repositoryName);
  });

  return button;
};

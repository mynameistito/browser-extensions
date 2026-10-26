import "../assets/github.css";

const COPYABLE_ATTRIBUTE = "data-repocopy-confirmation-name";
const CONFIRMATION_PREFIX = "To confirm, type";
const ARIA_LABEL_ATTRIBUTE = "aria-label";
const iconResetTimers = new WeakMap<HTMLButtonElement, number>();

const getRepository = (): { readonly name: string } | null => {
  const [, owner, repo, section] = window.location.pathname.split("/");

  return owner !== undefined && repo !== undefined && section === "settings"
    ? { name: `${owner}/${repo}` }
    : null;
};

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

const copyRepositoryName = async (
  button: HTMLButtonElement,
  name: string
): Promise<void> => {
  try {
    await navigator.clipboard.writeText(name);
    button.setAttribute(ARIA_LABEL_ATTRIBUTE, `Copied ${name}`);
    button.classList.add("repocopy-copied");
    button.querySelector("svg")?.replaceWith(createIcon("check"));
  } catch {
    button.setAttribute(ARIA_LABEL_ATTRIBUTE, `Could not copy ${name}`);
    window.setTimeout(() => {
      button.setAttribute(ARIA_LABEL_ATTRIBUTE, `Copy ${name}`);
    }, 1400);

    return;
  }

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

const makeLabelCopyable = (
  label: HTMLLabelElement,
  repositoryName: string
): void => {
  const labelText = label.textContent;

  if (
    label.querySelector(`[${COPYABLE_ATTRIBUTE}]`) ||
    !labelText.trim().startsWith(CONFIRMATION_PREFIX)
  ) {
    return;
  }

  const walker = document.createTreeWalker(label, NodeFilter.SHOW_ALL);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    if (walker.currentNode instanceof Text) {
      textNodes.push(walker.currentNode);
    }
  }

  const textNode = textNodes.find((node) =>
    (node.nodeValue ?? "").includes(repositoryName)
  );

  if (textNode === undefined) {
    return;
  }

  const text = textNode.data;
  const nameStart = text.indexOf(repositoryName);

  const hasOpeningQuote = /["'“‘]$/u.test(text.slice(0, nameStart));

  const hasClosingQuote = /^["'”’]/u.test(
    text.slice(nameStart + repositoryName.length)
  );

  const nameAndAfter = textNode.splitText(nameStart - Number(hasOpeningQuote));

  if (hasOpeningQuote) {
    nameAndAfter.data = nameAndAfter.data.slice(1);
  }

  const afterName = nameAndAfter.splitText(repositoryName.length);

  if (hasClosingQuote) {
    afterName.data = afterName.data.slice(1);
  }

  const button = document.createElement("button");
  const code = document.createElement("code");
  code.textContent = repositoryName;
  button.append(code, createIcon("copy"));
  nameAndAfter.nodeValue = "";
  nameAndAfter.parentNode?.insertBefore(button, afterName);
  button.className = "repocopy-inline-code";
  button.setAttribute(COPYABLE_ATTRIBUTE, "");
  button.setAttribute(ARIA_LABEL_ATTRIBUTE, `Copy ${repositoryName}`);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void copyRepositoryName(button, repositoryName);
  });
};

const makeConfirmationLabelsCopyable = (): void => {
  const repository = getRepository();

  if (repository === null) {
    return;
  }

  const labels = document.querySelectorAll<HTMLLabelElement>(
    'dialog label, [role="dialog"] label, label.FormControl-label'
  );

  for (const label of labels) {
    makeLabelCopyable(label, repository.name);
  }
};

/** Installs the dialog observer and GitHub navigation listeners. */
export const startContentScript = (): void => {
  const observer = new MutationObserver(makeConfirmationLabelsCopyable);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  makeConfirmationLabelsCopyable();
  window.addEventListener("popstate", makeConfirmationLabelsCopyable);
  window.addEventListener("turbo:load", makeConfirmationLabelsCopyable);
};

export default defineContentScript({
  main: startContentScript,
  matches: ["https://github.com/*/*"],
  runAt: "document_idle",
});

import "../assets/github.css";

const COPYABLE_ATTRIBUTE = "data-repocopy-confirmation-name";
const iconResetTimers = new WeakMap<HTMLButtonElement, number>();

const getRepository = (): { readonly name: string } | null => {
  const [, owner, repo, section] = window.location.pathname.split("/");
  return owner && repo && section === "settings"
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
    button.setAttribute("aria-label", `Copied ${name}`);
    button.classList.add("repocopy-copied");
    button.querySelector("svg")?.replaceWith(createIcon("check"));
  } catch {
    button.setAttribute("aria-label", `Could not copy ${name}`);
    window.setTimeout(
      () => button.setAttribute("aria-label", `Copy ${name}`),
      1400
    );
    return;
  }

  const previousTimer = iconResetTimers.get(button);
  if (previousTimer) {
    window.clearTimeout(previousTimer);
  }

  const resetTimer = window.setTimeout(() => {
    button.setAttribute("aria-label", `Copy ${name}`);
    button.classList.remove("repocopy-copied");
    button.querySelector("svg")?.replaceWith(createIcon("copy"));
    iconResetTimers.delete(button);
  }, 1400);
  iconResetTimers.set(button, resetTimer);
};

const makeConfirmationLabelsCopyable = (): void => {
  const repository = getRepository();
  if (!repository) {
    return;
  }

  const labels = document.querySelectorAll(
    'dialog label, [role="dialog"] label, label.FormControl-label'
  );

  for (const label of labels) {
    if (
      label.querySelector(`[${COPYABLE_ATTRIBUTE}]`) ||
      !label.textContent?.trim().startsWith("To confirm, type")
    ) {
      continue;
    }

    const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
    let textNode: Node | null;
    while ((textNode = walker.nextNode())) {
      const text = textNode.nodeValue ?? "";
      const nameStart = text.indexOf(repository.name);
      if (nameStart === -1 || !(textNode instanceof Text)) {
        continue;
      }

      const hasOpeningQuote = /["'“‘]$/u.test(text.slice(0, nameStart));
      const hasClosingQuote = /^["'”’]/u.test(
        text.slice(nameStart + repository.name.length)
      );
      const nameAndAfter = textNode.splitText(
        nameStart - Number(hasOpeningQuote)
      );
      if (hasOpeningQuote) {
        nameAndAfter.nodeValue = nameAndAfter.nodeValue?.slice(1) ?? "";
      }

      const afterName = nameAndAfter.splitText(repository.name.length);
      if (hasClosingQuote) {
        afterName.nodeValue = afterName.nodeValue?.slice(1) ?? "";
      }

      const button = document.createElement("button");
      const code = document.createElement("code");
      code.textContent = repository.name;
      button.append(code, createIcon("copy"));
      nameAndAfter.nodeValue = "";
      nameAndAfter.parentNode?.insertBefore(button, afterName);
      button.className = "repocopy-inline-code";
      button.setAttribute(COPYABLE_ATTRIBUTE, "");
      button.setAttribute("aria-label", `Copy ${repository.name}`);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void copyRepositoryName(button, repository.name);
      });
      break;
    }
  }
};

export default defineContentScript({
  main: () => {
    const observer = new MutationObserver(makeConfirmationLabelsCopyable);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    makeConfirmationLabelsCopyable();
    window.addEventListener("popstate", makeConfirmationLabelsCopyable);
    window.addEventListener("turbo:load", makeConfirmationLabelsCopyable);
  },
  matches: ["https://github.com/*/*"],
  runAt: "document_idle",
});

import "../assets/github.css";
import { enhanceConfirmationLabels } from "../lib/confirmation-labels";
import { getRepositoryName } from "../lib/repository-path";

const scanCurrentPage = (): void => {
  const repositoryName = getRepositoryName(window.location.pathname);

  if (repositoryName !== null) {
    enhanceConfirmationLabels(document, repositoryName);
  }
};

/** Installs the dialog observer and GitHub navigation listeners. */
export const startContentScript = (): void => {
  const observer = new MutationObserver(scanCurrentPage);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  scanCurrentPage();
  window.addEventListener("popstate", scanCurrentPage);
  window.addEventListener("turbo:load", scanCurrentPage);
};

export default defineContentScript({
  main: startContentScript,
  matches: ["https://github.com/*/*"],
  runAt: "document_idle",
});

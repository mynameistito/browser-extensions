const VEIL_CLASS = "ip-veil-hidden";
const STYLE_ID = "ip-veil-styles";
const EXCLUDED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "TEXTAREA",
  "INPUT",
  "NOSCRIPT",
  "TITLE",
]);

const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const shouldProcess = (node: Node): boolean => {
  const parent = node.parentElement;
  return Boolean(
    parent &&
    !parent.closest(`.${VEIL_CLASS}`) &&
    !EXCLUDED_TAGS.has(parent.tagName)
  );
};

const createVeil = (ip: string): HTMLSpanElement => {
  const veil = document.createElement("span");
  veil.className = VEIL_CLASS;
  veil.dataset.ip = ip;
  veil.setAttribute(
    "aria-label",
    "Your IP address is blurred. Hover to reveal."
  );

  const value = document.createElement("span");
  value.className = "ip-veil-value";
  value.textContent = ip;
  const label = document.createElement("span");
  label.className = "ip-veil-label";
  label.setAttribute("aria-hidden", "true");
  label.textContent = "your-ip";
  veil.append(value, label);

  veil.addEventListener("pointerenter", () => {
    veil.classList.add("ip-veil-visible");
    veil.setAttribute("aria-label", "Your IP address is visible.");
  });
  veil.addEventListener("pointerleave", () => {
    veil.classList.remove("ip-veil-visible");
    veil.setAttribute(
      "aria-label",
      "Your IP address is blurred. Hover to reveal."
    );
  });

  return veil;
};

const veilTextNode = (textNode: Text, matcher: RegExp): void => {
  const value = textNode.nodeValue;
  if (!value || !matcher.test(value)) {
    return;
  }
  matcher.lastIndex = 0;

  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const match of value.matchAll(matcher)) {
    const matchStart = match.index ?? 0;
    fragment.append(value.slice(cursor, matchStart));
    fragment.append(createVeil(match[0]));
    cursor = matchStart + match[0].length;
  }
  fragment.append(value.slice(cursor));
  textNode.replaceWith(fragment);
};

const veilMatches = (root: ParentNode, matcher: RegExp): void => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      shouldProcess(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    if (walker.currentNode instanceof Text) {
      textNodes.push(walker.currentNode);
    }
  }
  for (const node of textNodes) {
    veilTextNode(node, matcher);
  }
};

const veilNode = (node: Node, matcher: RegExp): void => {
  if (node instanceof Text) {
    veilTextNode(node, matcher);
    return;
  }

  if (node instanceof Element) {
    veilMatches(node, matcher);
  }
};

const redactTitles = (ip: string): void => {
  const replacement = "your-ip";
  if (document.title.includes(ip)) {
    document.title = document.title.replaceAll(ip, replacement);
  }

  for (const element of document.querySelectorAll<HTMLElement>("[title]")) {
    const title = element.getAttribute("title");
    if (title?.includes(ip)) {
      element.setAttribute("title", title.replaceAll(ip, replacement));
    }
  }
};

const injectStyles = (): void => {
  if (document.querySelector(`#${STYLE_ID}`)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${VEIL_CLASS} {
      display: inline-block;
      box-sizing: border-box;
      font: inherit !important;
      line-height: inherit;
      letter-spacing: normal;
      cursor: pointer;
      user-select: none;
      vertical-align: baseline;
      position: relative;
    }
    .${VEIL_CLASS} .ip-veil-value {
      filter: blur(5px);
      transition: filter 600ms ease;
    }
    .${VEIL_CLASS} .ip-veil-label {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: #e53935 !important;
      font: inherit;
      pointer-events: none;
      transition: opacity 600ms ease;
    }
    .${VEIL_CLASS}:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
    .${VEIL_CLASS}.ip-veil-visible .ip-veil-value {
      filter: blur(0);
    }
    .${VEIL_CLASS}.ip-veil-visible .ip-veil-label { opacity: 0; }
    @media (prefers-reduced-motion: reduce) { .${VEIL_CLASS} { animation: none; transition: none; } }
  `;
  document.documentElement.append(style);
};

const start = async (): Promise<void> => {
  let response: unknown;
  try {
    response = await browser.runtime.sendMessage({ type: "IP_VEIL_GET_IP" });
  } catch {
    // A lookup failure should never affect the website being visited.
    return;
  }

  if (typeof response !== "string" || !response) {
    return;
  }

  injectStyles();
  const matcher = new RegExp(
    `(?<![\\w.:])${escapeRegExp(response)}(?![\\w.:])`,
    "gu"
  );
  veilMatches(document.body, matcher);
  redactTitles(response);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        veilNode(node, matcher);
      }
    }
    redactTitles(response);
  });

  observer.observe(document.documentElement, {
    attributeFilter: ["title"],
    attributes: true,
    childList: true,
    subtree: true,
  });
};

export default defineContentScript({
  main: () => {
    void start();
  },
  matches: ["<all_urls>"],
  runAt: "document_idle",
});

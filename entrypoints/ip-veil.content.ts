const VEIL_CLASS = 'ip-veil-hidden';
const STYLE_ID = 'ip-veil-styles';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    void start();
  },
});

async function start() {
  let ip: string | null;
  try {
    ip = await browser.runtime.sendMessage({ type: 'IP_VEIL_GET_IP' }) as string | null;
  } catch {
    // A lookup failure should never affect the website being visited.
    return;
  }
  if (!ip) return;

  injectStyles();
  const matcher = new RegExp(`(?<![\\w.:])${escapeRegExp(ip)}(?![\\w.:])`, 'g');
  veilMatches(document.body, matcher);
  redactTitles(ip);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) veilNode(node, matcher);
    }
    redactTitles(ip);
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['title'],
    childList: true,
    subtree: true,
  });
}

function veilNode(node: Node, matcher: RegExp) {
  if (node.nodeType === Node.TEXT_NODE) {
    veilTextNode(node as Text, matcher);
    return;
  }

  if (node.nodeType === Node.ELEMENT_NODE) veilMatches(node as Element, matcher);
}

function veilMatches(root: ParentNode, matcher: RegExp) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => shouldProcess(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  textNodes.forEach((node) => veilTextNode(node, matcher));
}

function shouldProcess(node: Node) {
  const parent = node.parentElement;
  if (!parent || parent.closest(`.${VEIL_CLASS}`)) return false;
  return !['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'TITLE'].includes(parent.tagName);
}

function redactTitles(ip: string) {
  const replacement = 'your-ip';
  if (document.title.includes(ip)) document.title = document.title.replaceAll(ip, replacement);

  document.querySelectorAll<HTMLElement>('[title]').forEach((element) => {
    const title = element.getAttribute('title');
    if (title?.includes(ip)) element.setAttribute('title', title.replaceAll(ip, replacement));
  });
}

function veilTextNode(textNode: Text, matcher: RegExp) {
  const value = textNode.nodeValue;
  if (!value || !matcher.test(value)) return;
  matcher.lastIndex = 0;

  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const match of value.matchAll(matcher)) {
    const start = match.index ?? 0;
    fragment.append(value.slice(cursor, start));
    fragment.append(createVeil(match[0]));
    cursor = start + match[0].length;
  }
  fragment.append(value.slice(cursor));
  textNode.replaceWith(fragment);
}

function createVeil(ip: string) {
  const veil = document.createElement('span');
  veil.className = VEIL_CLASS;
  veil.dataset.ip = ip;
  veil.setAttribute('aria-label', 'Your IP address is blurred. Hover to reveal.');
  veil.innerHTML = '<span class="ip-veil-value"></span><span class="ip-veil-label" aria-hidden="true">your-ip</span>';
  veil.querySelector('.ip-veil-value')!.textContent = ip;

  veil.addEventListener('pointerenter', () => {
    veil.classList.add('ip-veil-visible');
    veil.setAttribute('aria-label', 'Your IP address is visible.');
  });
  veil.addEventListener('pointerleave', () => {
    veil.classList.remove('ip-veil-visible');
    veil.setAttribute('aria-label', 'Your IP address is blurred. Hover to reveal.');
  });

  return veil;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
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
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

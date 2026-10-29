import { buildRegex } from "./redaction-address";
import {
  cleanupRemovedSubtree,
  reconcileDetachedSubtrees,
  refreshReinsertedWrappers,
  restoreDetachedSubtrees,
  restoreDetachedWrappers,
} from "./redaction-detached";
import {
  pruneDetachedWrapperReferences,
  restoreTrackedContent,
} from "./redaction-restoration";
import {
  SCANNABLE_ATTRS,
  scanAttributes,
  scanMutation,
  scanSubtree,
} from "./redaction-scan";
import { createRestorations } from "./redaction-state";

export { isValidIpv6 } from "./redaction-address";

export { pruneDetachedWrapperReferences } from "./redaction-restoration";

/** Controls the public redactor state and observer lifecycle. */
export interface Redactor {
  /** Replace the email list used by the redactor. */
  setEmails: (emails: string[]) => void;
  /** Enable or disable automatic IPv4 and IPv6 masking. */
  setHideIpAddresses: (enabled: boolean) => void;
  /** Begin observing and redact the existing document content. */
  start: () => void;
  /** Stop observing and cancel queued scans. */
  stop: () => void;
}

/**
 * Create an observer that redacts matching email addresses in a document.
 * @param root - Document to scan, defaulting to the current document.
 * @returns Controls for updating, starting, and stopping the redactor.
 */
export const createRedactor = (root?: Document): Redactor => {
  const doc = root ?? document;
  let regex: RegExp | null = null;
  let emails: string[] = [];
  let hideIpAddresses = false;
  let observer: MutationObserver | null = null;
  let scheduled = false;
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingIdle: number | null = null;
  let pendingMutations: MutationRecord[] = [];
  let skipCache = new WeakMap<Element, boolean>();
  const restorations = createRestorations();

  const processMutationRecords = (
    mutations: readonly MutationRecord[],
    activeRegex: RegExp | null
  ): void => {
    pruneDetachedWrapperReferences(restorations.detachedWrappers);

    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        cleanupRemovedSubtree(node, doc, activeRegex, restorations);
      }
    }

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        refreshReinsertedWrappers(node, doc, activeRegex, restorations);
      }
    }
  };

  const flush = (mutations: MutationRecord[]): void => {
    skipCache = new WeakMap<Element, boolean>();

    if (!regex) {
      return;
    }

    for (const mutation of mutations) {
      scanMutation(mutation, regex, skipCache, restorations);
    }
  };

  const scheduleFlush = (mutations: MutationRecord[]): void => {
    pendingMutations.push(...mutations);

    if (scheduled) {
      return;
    }

    scheduled = true;

    const run = () => {
      const captured = pendingMutations;
      pendingMutations = [];
      scheduled = false;
      pendingTimeout = null;
      pendingIdle = null;

      flush(captured);
    };

    if ("requestIdleCallback" in window) {
      pendingIdle = requestIdleCallback(run, { timeout: 500 });
    } else {
      pendingTimeout = setTimeout(run, 100);
    }
  };

  const cancelScheduledFlush = (): void => {
    if (pendingTimeout !== null) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }

    if (pendingIdle !== null) {
      cancelIdleCallback(pendingIdle);
      pendingIdle = null;
    }

    scheduled = false;
  };

  const drainPendingMutations = (): void => {
    pendingMutations = [];
    cancelScheduledFlush();

    const observerMutations = observer?.takeRecords() ?? [];
    processMutationRecords(observerMutations, regex);
  };

  const initialScan = (): void => {
    if (!regex) {
      return;
    }

    skipCache = new WeakMap<Element, boolean>();
    scanSubtree(doc.body ?? doc, regex, skipCache, restorations);
  };

  const start = (): void => {
    if (doc.readyState === "loading") {
      doc.addEventListener(
        "DOMContentLoaded",
        () => {
          initialScan();
        },
        {
          once: true,
        }
      );
    } else {
      initialScan();
    }

    observer = new MutationObserver((mutations) => {
      processMutationRecords(mutations, regex);
      scheduleFlush(mutations);
    });
    observer.observe(doc.documentElement, {
      attributeFilter: [...SCANNABLE_ATTRS],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  };

  const stop = (): void => {
    drainPendingMutations();
    restoreDetachedWrappers(restorations);
    restoreDetachedSubtrees(restorations);
    observer?.disconnect();
    observer = null;
    pendingMutations = [];
  };

  const updateConfiguration = (): void => {
    drainPendingMutations();
    restoreDetachedWrappers(restorations);
    regex = buildRegex(emails, hideIpAddresses);
    reconcileDetachedSubtrees(restorations, regex);
    restoreTrackedContent(doc.documentElement ?? doc, restorations);

    if (observer && regex) {
      skipCache = new WeakMap<Element, boolean>();
      scanSubtree(doc.body ?? doc, regex, skipCache, restorations);

      if (doc.body !== null) {
        scanAttributes(doc.documentElement, regex, skipCache, restorations);
      }
    }
  };

  return {
    setEmails(nextEmails: string[]) {
      emails = nextEmails;
      updateConfiguration();
    },
    setHideIpAddresses(enabled: boolean) {
      hideIpAddresses = enabled;
      updateConfiguration();
    },
    start,
    stop,
  };
};

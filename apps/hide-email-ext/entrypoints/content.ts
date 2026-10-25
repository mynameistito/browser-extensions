import { defineContentScript } from "wxt/utils/define-content-script";

import { createRedactor } from "@/src/lib/redact";
import { hiddenEmailsItem } from "@/src/lib/storage";

/**
 * Subscribe to email changes before applying the initial storage snapshot.
 *
 * @param read - Reads the initial stored value.
 * @param watch - Subscribes to subsequent stored values.
 * @param apply - Applies the selected value.
 * @returns Nothing.
 */
export const initializeContentEmails = async (
  read: () => Promise<string[] | null | undefined>,
  watch: (listener: (value: string[] | null | undefined) => void) => void,
  apply: (value: string[] | null | undefined) => void
): Promise<void> => {
  let hasReceivedUpdate = false;

  watch((value) => {
    hasReceivedUpdate = true;
    apply(value);
  });

  try {
    const initialValue = await read();

    if (!hasReceivedUpdate) {
      apply(initialValue ?? []);
    }
  } catch {
    if (!hasReceivedUpdate) {
      apply([]);
    }
  }
};

/**
 * Create an email-list applier that starts and stops the redactor as needed.
 *
 * @param redactor - The redactor controlled by the content script.
 * @returns A function that applies the current email list.
 */
export const createContentEmailApplier = (
  redactor: Pick<
    ReturnType<typeof createRedactor>,
    "setEmails" | "start" | "stop"
  >
): ((value: string[] | null | undefined) => void) => {
  let started = false;

  return (next) => {
    const list = next ?? [];
    redactor.setEmails(list);

    if (!started && list.length > 0) {
      started = true;
      redactor.start();
    } else if (started && list.length === 0) {
      started = false;
      redactor.stop();
    }
  };
};

export default defineContentScript({
  async main() {
    const redactor = createRedactor();

    await initializeContentEmails(
      async () => await hiddenEmailsItem.getValue(),
      (listener) => {
        hiddenEmailsItem.watch(listener);
      },
      createContentEmailApplier(redactor)
    );
  },
  matches: ["<all_urls>"],
  runAt: "document_start",
});

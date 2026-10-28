import { isEmail } from "@/src/lib/email";
import {
  addHiddenEmail,
  getHiddenEmails,
  getHideIpAddresses,
  hiddenEmailsItem,
  hideIpAddressesItem,
  removeHiddenEmail,
  setHideIpAddresses,
} from "@/src/lib/storage";

const UNKNOWN_ERROR = "unknown error";

/**
 * Subscribe to email changes before applying the initial storage snapshot.
 *
 * @param read - Reads the initial stored value.
 * @param watch - Subscribes to subsequent stored values.
 * @param apply - Applies the selected value.
 * @returns Nothing.
 */
export const initializePopupEmails = async (
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
  } catch (error) {
    if (!hasReceivedUpdate) {
      console.error("Failed to load emails:", error);
      apply([]);
    }
  }
};

/** Subscribe to the IP masking setting before applying its initial value.
 * @param read - Reads the initial stored value.
 * @param watch - Subscribes to subsequent values.
 * @param apply - Applies the selected value.
 * @returns Nothing.
 */
export const initializePopupIpMasking = async (
  read: () => Promise<boolean | null | undefined>,
  watch: (listener: (value: boolean | null | undefined) => void) => void,
  apply: (value: boolean | null | undefined) => void
): Promise<void> => {
  let hasReceivedUpdate = false;

  watch((value) => {
    hasReceivedUpdate = true;
    apply(value);
  });

  try {
    const initialValue = await read();

    if (!hasReceivedUpdate) {
      apply(initialValue ?? false);
    }
  } catch (error) {
    if (!hasReceivedUpdate) {
      console.error("Failed to load IP masking setting:", error);
      apply(false);
    }
  }
};

const getById = <T extends HTMLElement>(id: string, ctor: new () => T): T => {
  const el = document.querySelector<HTMLElement>(`#${id}`);

  if (!(el instanceof ctor)) {
    throw new TypeError(`Element #${id} not found or wrong type`);
  }

  return el;
};

const input = getById("email-input", HTMLInputElement);
const addBtn = getById("add-btn", HTMLButtonElement);
const errorSpan = getById("error", HTMLSpanElement);
const list = getById("email-list", HTMLUListElement);
const hideIpToggle = getById("hide-ip-toggle", HTMLInputElement);

const renderList = (emails: string[]): void => {
  list.replaceChildren();

  for (const email of emails) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = email;
    const btn = document.createElement("button");
    btn.className = "remove-btn";
    btn.textContent = "\u00D7";
    btn.setAttribute("aria-label", `Remove ${email}`);
    btn.addEventListener("click", () => {
      void (async () => {
        try {
          await removeHiddenEmail(email);
        } catch (error) {
          errorSpan.textContent = `Failed to remove email: ${error instanceof Error ? error.message : UNKNOWN_ERROR}`;
        }
      })();
    });
    li.append(span);
    li.append(btn);
    list.append(li);
  }
};

const handleAdd = async (): Promise<void> => {
  errorSpan.textContent = "";
  const raw = input.value;

  if (!isEmail(raw)) {
    errorSpan.textContent = "Please enter a valid email address.";

    return;
  }

  const email = raw.trim().toLowerCase();

  try {
    await addHiddenEmail(email);
    input.value = "";
  } catch (error) {
    errorSpan.textContent = `Failed to add email: ${error instanceof Error ? error.message : UNKNOWN_ERROR}`;
  }
};

const handleKeydown = async (e: KeyboardEvent): Promise<void> => {
  if (e.key === "Enter") {
    try {
      await handleAdd();
    } catch (error) {
      console.error("handleAdd failed:", error);
    }
  }
};

addBtn.addEventListener("click", () => {
  void handleAdd();
});

input.addEventListener("keydown", (event) => {
  void handleKeydown(event);
});

hideIpToggle.addEventListener("change", () => {
  errorSpan.textContent = "";
  void (async () => {
    try {
      await setHideIpAddresses(hideIpToggle.checked);
    } catch (error) {
      errorSpan.textContent = `Failed to save IP masking setting: ${error instanceof Error ? error.message : UNKNOWN_ERROR}`;
      hideIpToggle.checked = await getHideIpAddresses().catch(() => false);
    }
  })();
});

const init = async (): Promise<void> => {
  await Promise.all([
    initializePopupEmails(
      async () => await getHiddenEmails(),
      (listener) => {
        hiddenEmailsItem.watch(listener);
      },
      (next) => {
        renderList(next ?? []);
      }
    ),
    initializePopupIpMasking(
      async () => await getHideIpAddresses(),
      (listener) => {
        hideIpAddressesItem.watch(listener);
      },
      (next) => {
        hideIpToggle.checked = next ?? false;
      }
    ),
  ]);
};

void (async () => {
  try {
    await init();
  } catch (error) {
    console.error("Popup init failed:", error);
  }
})();

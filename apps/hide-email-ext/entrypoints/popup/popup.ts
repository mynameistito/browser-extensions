import { isEmail, normalize } from "@/src/lib/email";
import {
  addHiddenEmail,
  getHiddenEmails,
  hiddenEmailsItem,
  removeHiddenEmail,
} from "@/src/lib/storage";

const getById = <T extends HTMLElement>(id: string, ctor: new () => T): T => {
  const el = document.querySelector<HTMLElement>(`#${id}`);

  if (!(el instanceof ctor)) {
    throw new Error(`Element #${id} not found or wrong type`);
  }

  return el;
};

const input = getById("email-input", HTMLInputElement);
const addBtn = getById("add-btn", HTMLButtonElement);
const errorSpan = getById("error", HTMLSpanElement);
const list = getById("email-list", HTMLUListElement);

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
          errorSpan.textContent = `Failed to remove email: ${error instanceof Error ? error.message : "unknown error"}`;
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

  const email = normalize(raw);

  if (email === null) {
    errorSpan.textContent = "Please enter a valid email address.";

    return;
  }

  try {
    await addHiddenEmail(email);
    input.value = "";
  } catch (error) {
    errorSpan.textContent = `Failed to add email: ${error instanceof Error ? error.message : "unknown error"}`;
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

const init = async (): Promise<void> => {
  try {
    renderList((await getHiddenEmails()) ?? []);
  } catch (error) {
    console.error("Failed to load emails:", error);
    renderList([]);
  }

  hiddenEmailsItem.watch((next) => {
    renderList(next ?? []);
  });
};

void (async () => {
  try {
    await init();
  } catch (error) {
    console.error("Popup init failed:", error);
  }
})();

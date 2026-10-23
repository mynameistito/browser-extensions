import { storage } from "wxt/utils/storage";

export const hiddenEmailsItem = storage.defineItem<string[]>(
  "sync:hiddenEmails",
  { fallback: [] }
);

/** Returns the normalized email addresses currently hidden by the extension.
 * @returns The stored email addresses.
 */
export const getHiddenEmails = async (): Promise<string[]> =>
  await hiddenEmailsItem.getValue();

/** Adds an email address to the hidden list if it is not already present.
 * @param email - The address to add.
 * @returns Nothing.
 */
export const addHiddenEmail = async (email: string): Promise<void> => {
  const current = await getHiddenEmails();

  if (current.includes(email)) {
    return;
  }

  await hiddenEmailsItem.setValue([...current, email]);
};

/** Removes an email address from the hidden list when present.
 * @param email - The address to remove.
 * @returns Nothing.
 */
export const removeHiddenEmail = async (email: string): Promise<void> => {
  const current = await getHiddenEmails();

  if (!current.includes(email)) {
    return;
  }

  await hiddenEmailsItem.setValue(current.filter((e) => e !== email));
};

import { storage } from "wxt/utils/storage";

export const hiddenEmailsItem = storage.defineItem<string[]>(
  "sync:hiddenEmails",
  { fallback: [] }
);

export const hideIpAddressesItem = storage.defineItem<boolean>(
  "sync:hideIpAddresses",
  { fallback: false }
);

/** Returns whether IP address masking is enabled.
 * @returns Whether the setting is enabled.
 */
export const getHideIpAddresses = async (): Promise<boolean> =>
  await hideIpAddressesItem.getValue();

/** Saves whether IP address masking is enabled.
 * @param enabled - Whether to mask IPv4 and IPv6 addresses.
 * @returns Nothing.
 */
export const setHideIpAddresses = async (enabled: boolean): Promise<void> => {
  await hideIpAddressesItem.setValue(enabled);
};

let hiddenEmailsQueue: Promise<void> = Promise.resolve();

const serializeHiddenEmailsUpdate = async (
  update: () => Promise<void>
): Promise<void> => {
  const operation = hiddenEmailsQueue.then(update);

  hiddenEmailsQueue = operation.catch(() => {
    // Keep the queue usable while returning the original rejection to its caller.
  });

  await operation;
};

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
  await serializeHiddenEmailsUpdate(async () => {
    const current = await getHiddenEmails();

    if (current.includes(email)) {
      return;
    }

    await hiddenEmailsItem.setValue([...current, email]);
  });
};

/** Removes an email address from the hidden list when present.
 * @param email - The address to remove.
 * @returns Nothing.
 */
export const removeHiddenEmail = async (email: string): Promise<void> => {
  await serializeHiddenEmailsUpdate(async () => {
    const current = await getHiddenEmails();

    if (!current.includes(email)) {
      return;
    }

    await hiddenEmailsItem.setValue(current.filter((e) => e !== email));
  });
};

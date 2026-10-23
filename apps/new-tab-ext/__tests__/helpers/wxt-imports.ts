type StorageValue =
  | string
  | number
  | boolean
  | null
  | readonly StorageValue[]
  | { readonly [key: string]: StorageValue };

const values = new Map<string, unknown>();

const isStorageValue = <TValue>(
  value: TValue
): value is TValue & StorageValue => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isStorageValue);
  }

  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every(isStorageValue)
  );
};

const failures = new Map<
  string,
  { readonly read?: Error; readonly write?: Error }
>();

/** Clears values and simulated storage errors between tests. */
export const clearWxtStorage = (): void => {
  values.clear();
  failures.clear();
};

/** Seeds a key with a JSON-compatible value for a test.
 * @param key - The storage key.
 * @param value - The value to return for that key.
 * @returns Nothing.
 */
export const seedWxtStorage = <TSeed>(
  key: string,
  value: TSeed
): TSeed & StorageValue => {
  if (!isStorageValue(value)) {
    throw new TypeError("WXT test storage only accepts JSON values.");
  }

  values.set(key, value);

  return value;
};

/** Configures a storage operation to reject with an error.
 * @param key - The storage key.
 * @param operation - Whether reads or writes should fail.
 * @param error - The error to reject with.
 * @returns Nothing.
 */
export const failWxtStorage = (
  key: string,
  operation: "read" | "write",
  error: Error
): void => {
  failures.set(key, { ...failures.get(key), [operation]: error });
};

export const storage = {
  defineItem(key: string, options: { readonly fallback: StorageValue }) {
    return {
      getValue: async (): Promise<StorageValue> => {
        await Promise.resolve();
        const error = failures.get(key)?.read;

        if (error) {
          throw error;
        }

        const value = values.get(key);

        return isStorageValue(value) ? value : options.fallback;
      },
      setValue: async (value: StorageValue): Promise<void> => {
        await Promise.resolve();
        const error = failures.get(key)?.write;

        if (error) {
          throw error;
        }

        values.set(key, value);
      },
    };
  },
};

type StorageValue =
  | string
  | number
  | boolean
  | null
  | readonly StorageValue[]
  | { readonly [key: string]: StorageValue };

const values = new Map<string, StorageValue>();
const failures = new Map<
  string,
  { readonly read?: Error; readonly write?: Error }
>();

export const clearWxtStorage = (): void => {
  values.clear();
  failures.clear();
};

export const seedWxtStorage = <T>(key: string, value: T): void => {
  // SAFETY: Tests seed extension storage with JSON-compatible domain records; production boundaries decode these values before use.
  values.set(key, value as StorageValue);
};

export const failWxtStorage = (
  key: string,
  operation: "read" | "write",
  error: Error
): void => {
  failures.set(key, { ...failures.get(key), [operation]: error });
};

export const storage = {
  defineItem<T>(key: string, options: { readonly fallback: T }) {
    return {
      getValue: (): Promise<T> => {
        const error = failures.get(key)?.read;
        if (error) {
          return Promise.reject(error);
        }

        if (!values.has(key)) {
          return Promise.resolve(options.fallback);
        }

        // SAFETY: Values are stored per key through this same typed item API; a missing value uses the typed fallback.
        return Promise.resolve(values.get(key) as T);
      },
      setValue: (value: T): Promise<void> => {
        const error = failures.get(key)?.write;
        if (error) {
          return Promise.reject(error);
        }

        // SAFETY: App storage values are JSON-compatible preferences and provider cache records.
        values.set(key, value as StorageValue);
        return Promise.resolve();
      },
    };
  },
};

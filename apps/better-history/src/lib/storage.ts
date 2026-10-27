import { Result } from "better-result";

import { StorageReadError } from "./errors/storage-read-error";
import { StorageValidationError } from "./errors/storage-validation-error";
import { StorageWriteError } from "./errors/storage-write-error";
import { StorageSchema } from "./schemas";
import type { StorageKey, StorageValue } from "./schemas";

/**
 * Read and validate one value from browser local storage.
 * @param key - Storage key to read.
 * @returns The parsed value, absence, or a read/validation error.
 */
export const readKey = async <K extends StorageKey>(
  key: K
): Promise<
  Result<StorageValue<K> | undefined, StorageReadError | StorageValidationError>
> => {
  const raw = await Result.tryPromise({
    catch: (cause) => new StorageReadError({ cause, key }),
    try: async () => await browser.storage.local.get(key),
  });

  if (Result.isError(raw)) {
    return Result.err<
      StorageValue<K> | undefined,
      StorageReadError | StorageValidationError
    >(raw.error);
  }

  const value = raw.value[key];

  if (value === undefined) {
    return Result.ok(value);
  }

  const parsed = StorageSchema[key].safeParse(value);

  if (!parsed.success) {
    return Result.err(
      new StorageValidationError({ issues: parsed.error.issues, key })
    );
  }

  return Result.ok(parsed.data);
};

/**
 * Read one storage value and use a fallback when it is absent.
 * @param key - Storage key to read.
 * @param fallback - Value returned when storage has no entry for the key.
 * @returns The parsed value or fallback, or a read/validation error.
 */
export const readKeyOr = async <K extends StorageKey>(
  key: K,
  fallback: StorageValue<K>
): Promise<
  Result<StorageValue<K>, StorageReadError | StorageValidationError>
> => {
  const r = await readKey(key);

  if (Result.isError(r)) {
    return Result.err<
      StorageValue<K>,
      StorageReadError | StorageValidationError
    >(r.error);
  }

  return Result.ok(r.value ?? fallback);
};

/**
 * Validate and write one value to browser local storage.
 * @param key - Storage key to write.
 * @param value - Value to validate and persist.
 * @returns A write or validation error when the operation fails.
 */
export const writeKey = async <K extends StorageKey>(
  key: K,
  value: StorageValue<K>
): Promise<Result<void, StorageWriteError | StorageValidationError>> => {
  const parsed = StorageSchema[key].safeParse(value);

  if (!parsed.success) {
    return Result.err(
      new StorageValidationError({ issues: parsed.error.issues, key })
    );
  }

  return await Result.tryPromise({
    catch: (cause) => new StorageWriteError({ cause, key }),
    try: async () => {
      await browser.storage.local.set({ [key]: parsed.data });
    },
  });
};

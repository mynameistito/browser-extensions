import { Result } from "better-result";

import {
  StorageReadError,
  StorageValidationError,
  StorageWriteError,
} from "@/lib/errors";
import { StorageSchema } from "@/lib/schemas";
import type { StorageKey, StorageValue } from "@/lib/schemas";

export const readKey = async <K extends StorageKey>(
  key: K
): Promise<
  Result<StorageValue<K> | undefined, StorageReadError | StorageValidationError>
> => {
  const raw = await Result.tryPromise({
    catch: (cause) => new StorageReadError({ cause, key }),
    try: () => browser.storage.local.get(key),
  });
  if (Result.isError(raw)) {
    return Result.err<
      StorageValue<K> | undefined,
      StorageReadError | StorageValidationError
    >(raw.error);
  }

  const value = raw.value[key];
  if (value === undefined) {
    return Result.ok(value as StorageValue<K> | undefined);
  }

  const parsed = StorageSchema[key].safeParse(value);
  if (!parsed.success) {
    return Result.err(
      new StorageValidationError({ issues: parsed.error.issues, key })
    );
  }
  return Result.ok(parsed.data as StorageValue<K>);
};

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

export const writeKey = <K extends StorageKey>(
  key: K,
  value: StorageValue<K>
): Promise<Result<void, StorageWriteError | StorageValidationError>> => {
  const parsed = StorageSchema[key].safeParse(value);
  if (!parsed.success) {
    return Promise.resolve(
      Result.err(
        new StorageValidationError({ issues: parsed.error.issues, key })
      )
    );
  }

  return Result.tryPromise({
    catch: (cause) => new StorageWriteError({ cause, key }),
    try: () => browser.storage.local.set({ [key]: parsed.data }),
  });
};

export const updateKey = async <K extends StorageKey>(
  key: K,
  fallback: StorageValue<K>,
  fn: (current: StorageValue<K>) => StorageValue<K>
) => {
  const r = await readKeyOr(key, fallback);
  if (Result.isError(r)) {
    return r;
  }
  return writeKey(key, fn(r.value));
};

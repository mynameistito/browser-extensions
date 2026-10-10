import { Result } from "better-result";
import {
  StorageReadError,
  StorageValidationError,
  StorageWriteError,
} from "@/lib/errors";
import {
  type StorageKey,
  StorageSchema,
  type StorageValue,
} from "@/lib/schemas";

export async function readKey<K extends StorageKey>(
  key: K
): Promise<
  Result<StorageValue<K> | undefined, StorageReadError | StorageValidationError>
> {
  const raw = await Result.tryPromise({
    try: () => browser.storage.local.get(key),
    catch: (cause) => new StorageReadError({ key, cause }),
  });
  if (Result.isError(raw)) {
    return raw;
  }

  const value = raw.value[key];
  if (value === undefined) {
    return Result.ok(undefined);
  }

  const parsed = StorageSchema[key].safeParse(value);
  if (!parsed.success) {
    return Result.err(
      new StorageValidationError({ key, issues: parsed.error.issues })
    );
  }
  return Result.ok(parsed.data as StorageValue<K>);
}

export async function readKeyOr<K extends StorageKey>(
  key: K,
  fallback: StorageValue<K>
): Promise<Result<StorageValue<K>, StorageReadError | StorageValidationError>> {
  const r = await readKey(key);
  if (Result.isError(r)) {
    return r;
  }
  return Result.ok(r.value ?? fallback);
}

export function writeKey<K extends StorageKey>(
  key: K,
  value: StorageValue<K>
): Promise<Result<void, StorageWriteError | StorageValidationError>> {
  const parsed = StorageSchema[key].safeParse(value);
  if (!parsed.success) {
    return Promise.resolve(
      Result.err(
        new StorageValidationError({ key, issues: parsed.error.issues })
      )
    );
  }

  return Result.tryPromise({
    try: () => browser.storage.local.set({ [key]: parsed.data }),
    catch: (cause) => new StorageWriteError({ key, cause }),
  });
}

export async function updateKey<K extends StorageKey>(
  key: K,
  fallback: StorageValue<K>,
  fn: (current: StorageValue<K>) => StorageValue<K>
) {
  const r = await readKeyOr(key, fallback);
  if (Result.isError(r)) {
    return r;
  }
  return writeKey(key, fn(r.value));
}

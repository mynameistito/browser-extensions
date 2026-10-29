import { expect, vi } from "vitest";

/** Storage values emitted by email settings watchers. */
export type StorageValue = string[] | null | undefined;

/** Callback that receives an email storage update. */
export type Watcher = (value: StorageValue) => void;

/** Callback that receives an IP masking storage update. */
export type BooleanWatcher = (value: boolean | null | undefined) => void;

/** Deferred promise state used to control asynchronous storage reads. */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

/** Email watcher source used by content-script tests. */
export interface WatchSource {
  emit: (value: StorageValue) => void;
  subscribe: (watcher: Watcher) => void;
}

/** Boolean watcher source used by IP settings tests. */
export interface BooleanWatchSource {
  emit: (value: boolean | null | undefined) => void;
  subscribe: (watcher: BooleanWatcher) => void;
}

/**
 * Create a promise whose completion is controlled by the test.
 * @returns A deferred promise and its resolver.
 */
export const createDeferred = <T>(): Deferred<T> => Promise.withResolvers<T>();

/**
 * Create an in-memory source for email watcher updates.
 * @returns A source that tests can emit values through.
 */
export const createWatchSource = (): WatchSource => {
  let listener: Watcher | null = null;

  return {
    emit: (value) => listener?.(value),
    subscribe: (watcher) => {
      listener = watcher;
    },
  };
};

/**
 * Create an in-memory source for IP masking watcher updates.
 * @returns A source that tests can emit values through.
 */
export const createBooleanWatchSource = (): BooleanWatchSource => {
  let listener: BooleanWatcher | null = null;

  return {
    emit: (value) => listener?.(value),
    subscribe: (watcher) => {
      listener = watcher;
    },
  };
};

/**
 * Wait until a popup email input reaches the expected value.
 * @param input - Input whose value is observed.
 * @param value - Value expected by the test.
 * @returns A promise that resolves when the value matches.
 */
export const expectInputValue = async (
  input: HTMLInputElement,
  value: string
): Promise<void> => {
  await vi.waitFor(() => {
    expect(input.value).toBe(value);
  });
};

/**
 * Assert that a popup list contains an email.
 * @param list - List whose text is checked.
 * @param value - Email expected in the list.
 */
export const expectListToContain = (
  list: HTMLUListElement,
  value: string
): void => {
  expect(list.textContent).toContain(value);
};

/**
 * Wait until a popup list no longer contains an email.
 * @param list - List whose text is checked.
 * @param value - Email expected to be absent.
 * @returns A promise that resolves when the email is absent.
 */
export const expectListNotToContain = async (
  list: HTMLUListElement,
  value: string
): Promise<void> => {
  await vi.waitFor(() => {
    expect(list.textContent).not.toContain(value);
  });
};

/**
 * Assert the final email list applied to a content redactor.
 * @param applied - Email lists applied during the test.
 * @param expected - Final email list expected by the test.
 */
export const expectLastApplied = (
  applied: StorageValue[],
  expected: StorageValue
): void => {
  expect(applied.at(-1)).toStrictEqual(expected);
};

/**
 * Wait until a popup error element displays the expected message.
 * @param error - Element that displays validation or storage errors.
 * @param expected - Error text expected by the test.
 * @returns A promise that resolves when the text matches.
 */
export const expectErrorText = async (
  error: HTMLSpanElement,
  expected: string
): Promise<void> => {
  await vi.waitFor(() => {
    expect(error.textContent).toBe(expected);
  });
};

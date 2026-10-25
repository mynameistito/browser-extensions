import { beforeEach, describe, expect, test } from "bun:test";

import { fakeBrowser } from "wxt/testing/fake-browser";

import {
  addHiddenEmail,
  getHiddenEmails,
  hiddenEmailsItem,
  removeHiddenEmail,
} from "../src/lib/storage";

const email1 = "alice@example.com";
const email2 = "bob@test.org";

describe("storage", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  test("getHiddenEmails returns empty array by default", async () => {
    const result = await getHiddenEmails();
    expect(result).toEqual([]);
  });

  test("addHiddenEmail stores an email", async () => {
    await addHiddenEmail(email1);

    const result = await getHiddenEmails();
    expect(result).toEqual([email1]);
  });

  test("addHiddenEmail does not add duplicates", async () => {
    await addHiddenEmail(email1);
    await addHiddenEmail(email1);

    const result = await getHiddenEmails();
    expect(result).toEqual([email1]);
  });

  test("addHiddenEmail preserves insertion order", async () => {
    await addHiddenEmail(email1);
    await addHiddenEmail(email2);

    const result = await getHiddenEmails();
    expect(result).toEqual([email1, email2]);
  });

  test("concurrent adds preserve each email in invocation order", async () => {
    await Promise.all([addHiddenEmail(email1), addHiddenEmail(email2)]);

    expect(await getHiddenEmails()).toEqual([email1, email2]);
  });

  test("concurrent duplicate adds remain idempotent", async () => {
    await Promise.all([addHiddenEmail(email1), addHiddenEmail(email1)]);

    expect(await getHiddenEmails()).toEqual([email1]);
  });

  test("concurrent add and remove preserve invocation order", async () => {
    await Promise.all([addHiddenEmail(email1), removeHiddenEmail(email1)]);

    expect(await getHiddenEmails()).toEqual([]);
  });

  test("a failed write is observed and does not block later updates", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      hiddenEmailsItem,
      "setValue"
    );

    const failure = new Error("storage write failed");

    Object.defineProperty(hiddenEmailsItem, "setValue", {
      configurable: true,
      value: async () => await Promise.reject(failure),
      writable: true,
    });

    let observedError: unknown;

    try {
      await addHiddenEmail(email1);
    } catch (error) {
      observedError = error;
    } finally {
      if (originalDescriptor !== undefined) {
        Object.defineProperty(hiddenEmailsItem, "setValue", originalDescriptor);
      }
    }

    expect(observedError).toBe(failure);

    await addHiddenEmail(email2);

    expect(await getHiddenEmails()).toEqual([email2]);
  });

  test("removeHiddenEmail removes an email", async () => {
    await addHiddenEmail(email1);
    await addHiddenEmail(email2);
    await removeHiddenEmail(email1);

    const result = await getHiddenEmails();
    expect(result).toEqual([email2]);
  });

  test("removeHiddenEmail handles non-existent email gracefully", async () => {
    await addHiddenEmail(email1);
    await removeHiddenEmail(email2);

    const result = await getHiddenEmails();
    expect(result).toEqual([email1]);
  });
});

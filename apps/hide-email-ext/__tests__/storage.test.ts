import { it, describe, expect, beforeEach } from "vitest";
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

  it("getHiddenEmails returns empty array by default", async () => {
    const result = await getHiddenEmails();
    expect(result).toStrictEqual([]);
  });

  it("addHiddenEmail stores an email", async () => {
    await addHiddenEmail(email1);

    const result = await getHiddenEmails();
    expect(result).toStrictEqual([email1]);
  });

  it("addHiddenEmail does not add duplicates", async () => {
    await addHiddenEmail(email1);
    await addHiddenEmail(email1);

    const result = await getHiddenEmails();
    expect(result).toStrictEqual([email1]);
  });

  it("addHiddenEmail preserves insertion order", async () => {
    await addHiddenEmail(email1);
    await addHiddenEmail(email2);

    const result = await getHiddenEmails();
    expect(result).toStrictEqual([email1, email2]);
  });

  it("concurrent adds preserve each email in invocation order", async () => {
    await Promise.all([addHiddenEmail(email1), addHiddenEmail(email2)]);

    await expect(getHiddenEmails()).resolves.toStrictEqual([email1, email2]);
  });

  it("concurrent duplicate adds remain idempotent", async () => {
    await Promise.all([addHiddenEmail(email1), addHiddenEmail(email1)]);

    await expect(getHiddenEmails()).resolves.toStrictEqual([email1]);
  });

  it("concurrent add and remove preserve invocation order", async () => {
    await Promise.all([addHiddenEmail(email1), removeHiddenEmail(email1)]);

    await expect(getHiddenEmails()).resolves.toStrictEqual([]);
  });

  it("a failed write is observed and does not block later updates", async () => {
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

    await expect(getHiddenEmails()).resolves.toStrictEqual([email2]);
  });

  it("removeHiddenEmail removes an email", async () => {
    await addHiddenEmail(email1);
    await addHiddenEmail(email2);
    await removeHiddenEmail(email1);

    const result = await getHiddenEmails();
    expect(result).toStrictEqual([email2]);
  });

  it("removeHiddenEmail handles non-existent email gracefully", async () => {
    await addHiddenEmail(email1);
    await removeHiddenEmail(email2);

    const result = await getHiddenEmails();
    expect(result).toStrictEqual([email1]);
  });
});

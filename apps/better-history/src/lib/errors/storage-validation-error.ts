import { TaggedError as defineTaggedErrorClass } from "better-result";

const StorageValidationErrorBase = defineTaggedErrorClass(
  "StorageValidationError"
)<{
  issues: unknown;
  key: string;
}>;

/** Stored data did not match its key's schema. */
export class StorageValidationError extends StorageValidationErrorBase {}

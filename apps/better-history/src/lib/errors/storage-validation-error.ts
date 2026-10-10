import { TaggedError as defineTaggedErrorClass } from "better-result";

const StorageValidationErrorBase = defineTaggedErrorClass(
  "StorageValidationError"
)<{
  issues: unknown;
  key: string;
}>();

export class StorageValidationError extends StorageValidationErrorBase {}

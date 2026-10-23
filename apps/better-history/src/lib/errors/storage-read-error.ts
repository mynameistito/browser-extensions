import { TaggedError as defineTaggedErrorClass } from "better-result";

const StorageReadErrorBase = defineTaggedErrorClass("StorageReadError")<{
  cause: unknown;
  key: string;
}>();

/** Failure while retrieving a value from extension storage. */
export class StorageReadError extends StorageReadErrorBase {}

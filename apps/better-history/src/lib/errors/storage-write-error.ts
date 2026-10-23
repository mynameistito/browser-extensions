import { TaggedError as defineTaggedErrorClass } from "better-result";

const StorageWriteErrorBase = defineTaggedErrorClass("StorageWriteError")<{
  cause: unknown;
  key: string;
}>();

/** Failure while persisting a value to extension storage. */
export class StorageWriteError extends StorageWriteErrorBase {}

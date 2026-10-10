import { TaggedError as defineTaggedErrorClass } from "better-result";

const StorageWriteErrorBase = defineTaggedErrorClass("StorageWriteError")<{
  cause: unknown;
  key: string;
}>();

export class StorageWriteError extends StorageWriteErrorBase {}

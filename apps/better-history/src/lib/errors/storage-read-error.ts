import { TaggedError as defineTaggedErrorClass } from "better-result";

const StorageReadErrorBase = defineTaggedErrorClass("StorageReadError")<{
  cause: unknown;
  key: string;
}>();

export class StorageReadError extends StorageReadErrorBase {}

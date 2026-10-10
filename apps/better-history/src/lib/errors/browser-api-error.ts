import { TaggedError as defineTaggedErrorClass } from "better-result";

const BrowserApiErrorBase = defineTaggedErrorClass("BrowserApiError")<{
  api: string;
  cause: unknown;
}>();

export class BrowserApiError extends BrowserApiErrorBase {}

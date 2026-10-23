import { TaggedError as defineTaggedErrorClass } from "better-result";

const BrowserApiErrorBase = defineTaggedErrorClass("BrowserApiError")<{
  api: string;
  cause: unknown;
}>;

/** Failure from a browser extension API call. */
export class BrowserApiError extends BrowserApiErrorBase {}

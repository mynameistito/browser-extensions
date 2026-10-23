import { TaggedError as defineTaggedErrorClass } from "better-result";

const PermissionDeniedErrorBase = defineTaggedErrorClass(
  "PermissionDeniedError"
)<{
  permissions: string[];
}>;

/** The browser declined a requested extension permission. */
export class PermissionDeniedError extends PermissionDeniedErrorBase {}

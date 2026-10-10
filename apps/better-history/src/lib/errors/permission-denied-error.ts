import { TaggedError as defineTaggedErrorClass } from "better-result";

const PermissionDeniedErrorBase = defineTaggedErrorClass(
  "PermissionDeniedError"
)<{
  permissions: string[];
}>();

export class PermissionDeniedError extends PermissionDeniedErrorBase {}

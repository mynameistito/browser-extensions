import { TaggedError } from "better-result";

export class StorageReadError extends TaggedError("StorageReadError")<{
  key: string;
  cause: unknown;
}>() {}

export class StorageWriteError extends TaggedError("StorageWriteError")<{
  key: string;
  cause: unknown;
}>() {}

export class StorageValidationError extends TaggedError(
  "StorageValidationError"
)<{
  key: string;
  issues: unknown;
}>() {}

export class BrowserApiError extends TaggedError("BrowserApiError")<{
  api: string;
  cause: unknown;
}>() {}

export class PermissionDeniedError extends TaggedError(
  "PermissionDeniedError"
)<{
  permissions: string[];
}>() {}

export class InvalidPatternError extends TaggedError("InvalidPatternError")<{
  pattern: string;
  reason: string;
}>() {}

import { TaggedError as defineTaggedErrorClass } from "better-result";

const InvalidPatternErrorBase = defineTaggedErrorClass("InvalidPatternError")<{
  pattern: string;
  reason: string;
}>();

export class InvalidPatternError extends InvalidPatternErrorBase {}

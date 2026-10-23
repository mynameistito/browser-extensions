import { TaggedError as defineTaggedErrorClass } from "better-result";

const InvalidPatternErrorBase = defineTaggedErrorClass("InvalidPatternError")<{
  pattern: string;
  reason: string;
}>;

/** A domain rule pattern that cannot be parsed or matched. */
export class InvalidPatternError extends InvalidPatternErrorBase {}

import { Result } from "better-result";

import { extensionMessaging } from "../../lib/messages";
import { CleanupSchema } from "../../lib/schemas";
import type { Cleanup } from "../../lib/schemas";
import { readKeyOr, writeKey } from "../../lib/storage";

/** Validated settings used until a saved cleanup preference is available. */
export const DEFAULT_CLEANUP = CleanupSchema.parse({});

/** An action that can be confirmed from cleanup settings. */
export type CleanupAction = "run-now" | "save";

/** User-facing outcome of saving settings or running cleanup. */
export type CleanupActionResult =
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "success";
      readonly message: string;
      readonly saved: boolean;
    };

/** Locale-aware formatter shared by the cleanup status and action message. */
const lastRunFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Format a saved cleanup time or describe an unset cleanup time.
 * @param lastRunAt - The saved cleanup timestamp, if available.
 * @returns A locale-aware timestamp or the "Never run" label.
 */
export const formatLastRun = (lastRunAt: number | undefined) => {
  if (lastRunAt === undefined) {
    return "Never run";
  }

  return lastRunFormatter.format(lastRunAt);
};

/**
 * Load validated cleanup settings, using schema defaults when none are saved.
 * @returns The validated saved value or schema defaults.
 */
export const loadCleanupSettings = async (): Promise<Cleanup> => {
  const result = await readKeyOr("cleanup", DEFAULT_CLEANUP);

  if (Result.isError(result)) {
    throw result.error;
  }

  return result.value;
};

/**
 * Save settings or run cleanup, then refresh the cached settings on success.
 * @param action - The confirmed cleanup action.
 * @param draft - Current settings displayed by the form.
 * @param invalidateQueries - Refreshes the cached cleanup settings.
 * @returns The visible success or error outcome.
 */
export const runCleanupAction = async (
  action: CleanupAction,
  draft: Cleanup,
  invalidateQueries: () => Promise<void>
): Promise<CleanupActionResult> => {
  try {
    if (action === "save") {
      const result = await writeKey("cleanup", draft);

      if (Result.isError(result)) {
        return { kind: "error", message: result.error.message };
      }

      await invalidateQueries();

      return {
        kind: "success",
        message: "Cleanup settings saved.",
        saved: true,
      };
    }

    const response = await extensionMessaging.sendMessage("cleanup.runNow", {});

    await invalidateQueries();

    return {
      kind: "success",
      message: `Cleanup finished at ${formatLastRun(response.lastRunAt)}.`,
      saved: false,
    };
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
};

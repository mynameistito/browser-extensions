import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Result } from "better-result";
import { useState } from "react";

import { ConfirmDeleteModal } from "@/features/cleanup/confirm-delete-modal";
import { extensionMessaging } from "@/lib/messages";
import { CleanupSchema } from "@/lib/schemas";
import type { Cleanup as CleanupConfig } from "@/lib/schemas";
import { readKeyOr, writeKey } from "@/lib/storage";

const DEFAULT_CLEANUP = CleanupSchema.parse({});

const SCHEDULES: {
  description: string;
  label: string;
  value: CleanupConfig["schedule"];
}[] = [
  {
    description: "Only remove history when you press Run now.",
    label: "Never",
    value: "never",
  },
  {
    description:
      "Best-effort cleanup when the browser shuts down, plus startup catchup.",
    label: "On close",
    value: "on-close",
  },
  {
    description: "Remove eligible history once every 24 hours.",
    label: "Daily",
    value: "daily",
  },
  {
    description: "Remove eligible history every seven days.",
    label: "Weekly",
    value: "weekly",
  },
  {
    description: "Remove eligible history roughly every 30 days.",
    label: "Monthly",
    value: "monthly",
  },
];

const RETENTIONS: {
  description: string;
  label: string;
  value: CleanupConfig["retention"];
}[] = [
  {
    description: "Aggressive cleanup for short-lived browsing trails.",
    label: "1 week",
    value: "1w",
  },
  {
    description: "A little breathing room for recently visited pages.",
    label: "2 weeks",
    value: "2w",
  },
  {
    description: "Keep the current month of history close at hand.",
    label: "1 month",
    value: "1m",
  },
  {
    description: "The least disruptive option for broad cleanup.",
    label: "3 months",
    value: "3m",
  },
];

type PendingAction = "run-now" | "save";

interface CleanupFormState {
  readonly draftOverride: CleanupConfig | null;
  readonly errorMessage: string | null;
  readonly isDirty: boolean;
  readonly isWorking: boolean;
  readonly pendingAction: PendingAction | null;
  readonly status: string | null;
}

type CleanupActionResult =
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "success";
      readonly message: string;
      readonly saved: boolean;
    };

const lastRunFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatLastRun = (lastRunAt: number | undefined) => {
  if (lastRunAt === undefined) {
    return "Never run";
  }

  return lastRunFormatter.format(lastRunAt);
};

const runCleanupAction = async (
  action: PendingAction,
  draft: CleanupConfig,
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

const optionClasses = (isSelected: boolean) =>
  [
    "rounded-xl border p-4 text-left transition",
    isSelected
      ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/10 dark:border-border dark:bg-muted dark:text-foreground"
      : "border-border bg-card hover:border-border hover:bg-muted dark:border-border dark:bg-card dark:hover:border-border dark:hover:bg-muted",
  ].join(" ");

/**
 * Render schedule and retention controls for automatic history cleanup.
 * @returns The cleanup schedule and retention settings form.
 */
export const CleanupForm = () => {
  const queryClient = useQueryClient();

  const [formState, setFormState] = useState<CleanupFormState>({
    draftOverride: null,
    errorMessage: null,
    isDirty: false,
    isWorking: false,
    pendingAction: null,
    status: null,
  });

  const query = useQuery({
    queryFn: async (): Promise<CleanupConfig> => {
      const result = await readKeyOr("cleanup", DEFAULT_CLEANUP);

      if (Result.isError(result)) {
        throw result.error;
      }

      return result.value;
    },
    queryKey: ["cleanup"],
  });

  const draft = formState.draftOverride ?? query.data ?? DEFAULT_CLEANUP;

  const updateDraft = (updater: (current: CleanupConfig) => CleanupConfig) => {
    setFormState((current) => ({
      ...current,
      draftOverride: updater(
        current.draftOverride ?? query.data ?? DEFAULT_CLEANUP
      ),
      isDirty: true,
    }));
  };

  const closeModal = () => {
    if (!formState.isWorking) {
      setFormState((current) => ({ ...current, pendingAction: null }));
    }
  };

  const confirmAction = async () => {
    if (!formState.pendingAction) {
      return;
    }

    setFormState((current) => ({
      ...current,
      errorMessage: null,
      isWorking: true,
      status: null,
    }));

    const result = await runCleanupAction(
      formState.pendingAction,
      draft,
      async () => {
        await queryClient.invalidateQueries({ queryKey: ["cleanup"] });
      }
    );

    setFormState((current) => ({
      ...current,
      draftOverride:
        result.kind === "success" && result.saved
          ? null
          : current.draftOverride,
      errorMessage: result.kind === "error" ? result.message : null,
      isDirty:
        result.kind === "success" && result.saved ? false : current.isDirty,
      isWorking: false,
      pendingAction: result.kind === "success" ? null : current.pendingAction,
      status: result.kind === "success" ? result.message : null,
    }));
  };

  if (query.isPending) {
    return (
      <p className="text-muted-foreground text-sm">Loading cleanup settings…</p>
    );
  }

  if (query.isError) {
    return (
      <div className="border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/20 dark:bg-destructive/10 dark:text-destructive rounded-xl border p-4 text-sm">
        Failed to load cleanup settings: {String(query.error)}
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <section className="border-border cleanup-hero dark:border-border overflow-hidden rounded-3xl border p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="tracking-eyebrow text-primary dark:text-primary text-xs font-semibold uppercase">
              Smart cleanup
            </p>
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight">
                Prune old history without touching the places you trust.
              </h2>
              <p className="text-muted-foreground dark:text-muted-foreground max-w-2xl text-sm leading-6">
                Choose how often Better History should remove older visits, how
                much recent history to keep, and whether whitelisted domains are
                preserved during cleanup.
              </p>
              <p className="text-muted-foreground dark:text-muted-foreground max-w-2xl text-sm leading-6">
                When whitelist exemptions are enabled, cleanup preserves recent
                activity for a URL. Older visits to that same URL may remain
                because the browser cannot remove only that URL’s older visits
                while preserving its recent visits and honoring URL exemptions.
              </p>
            </div>
          </div>
          <div className="border-border bg-card/70 dark:border-border dark:bg-card/70 rounded-2xl border p-4 text-sm shadow-sm backdrop-blur">
            <p className="text-muted-foreground">Last cleanup</p>
            <p className="mt-1 font-medium">{formatLastRun(draft.lastRunAt)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Schedule</h3>
          <p className="text-muted-foreground text-sm">
            Automatic cleanup runs in the background alarm loop.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {SCHEDULES.map((option) => (
            <label
              className={optionClasses(draft.schedule === option.value)}
              key={option.value}
            >
              <input
                checked={draft.schedule === option.value}
                className="sr-only"
                name="cleanup-schedule"
                onChange={() => {
                  updateDraft((current) => ({
                    ...current,
                    schedule: option.value,
                  }));
                }}
                type="radio"
              />
              <span className="text-sm font-medium">{option.label}</span>
              <span className="mt-2 block text-xs leading-5 opacity-75">
                {option.description}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Retention</h3>
          <p className="text-muted-foreground text-sm">
            Visits older than this window are eligible for deletion.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {RETENTIONS.map((option) => (
            <label
              className={optionClasses(draft.retention === option.value)}
              key={option.value}
            >
              <input
                checked={draft.retention === option.value}
                className="sr-only"
                name="cleanup-retention"
                onChange={() => {
                  updateDraft((current) => ({
                    ...current,
                    retention: option.value,
                  }));
                }}
                type="radio"
              />
              <span className="text-sm font-medium">{option.label}</span>
              <span className="mt-2 block text-xs leading-5 opacity-75">
                {option.description}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="border-border bg-card dark:border-border dark:bg-card rounded-2xl border p-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">
              Exempt whitelisted domains
            </span>
            <span className="text-muted-foreground mt-1 block text-sm leading-6">
              When enabled, cleanup preserves visits matching your whitelist
              rules even if they are older than the retention window.
            </span>
          </span>
          <input
            checked={draft.whitelistExempt}
            className="accent-primary dark:accent-primary mt-1 size-5"
            onChange={(event) => {
              updateDraft((current) => ({
                ...current,
                whitelistExempt: event.target.checked,
              }));
            }}
            type="checkbox"
          />
        </label>
      </section>

      {(formState.status !== null || formState.errorMessage !== null) && (
        <div
          className={
            formState.errorMessage === null
              ? "border-success/20 bg-success/10 text-success dark:border-success/20 dark:bg-success/10 dark:text-success rounded-xl border p-3 text-sm"
              : "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/20 dark:bg-destructive/10 dark:text-destructive rounded-xl border p-3 text-sm"
          }
        >
          {formState.errorMessage ?? formState.status}
        </div>
      )}

      <div className="border-border dark:border-border flex flex-col gap-2 border-t pt-5 sm:flex-row sm:justify-end">
        <button
          className="border-border hover:bg-muted dark:border-border dark:hover:bg-muted rounded-lg border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={formState.isWorking || formState.isDirty}
          onClick={() => {
            setFormState((current) => ({
              ...current,
              pendingAction: "run-now",
            }));
          }}
          type="button"
        >
          Run now
        </button>
        {formState.isDirty && (
          <span className="text-muted-foreground self-center text-xs">
            Save your changes before running cleanup.
          </span>
        )}
        <button
          className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:text-foreground dark:hover:bg-muted rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!formState.isDirty || formState.isWorking}
          onClick={() => {
            setFormState((current) => ({
              ...current,
              pendingAction: "save",
            }));
          }}
          type="button"
        >
          Save cleanup settings
        </button>
      </div>

      {formState.pendingAction && (
        <ConfirmDeleteModal
          body={
            formState.pendingAction === "save"
              ? "These settings control automatic history deletion. Better History will delete eligible visits according to this schedule."
              : "Better History will immediately delete visits older than your retention window. This cannot be undone."
          }
          confirmLabel={
            formState.pendingAction === "save" ? "Save settings" : "Run cleanup"
          }
          isBusy={formState.isWorking}
          onClose={closeModal}
          onConfirm={() => {
            void confirmAction();
          }}
          title={
            formState.pendingAction === "save"
              ? "Confirm cleanup settings"
              : "Run cleanup now?"
          }
        />
      )}
    </div>
  );
};

import { formatLastRun } from "@/features/cleanup/cleanup-settings";
import type { CleanupAction } from "@/features/cleanup/cleanup-settings";
import { CleanupSettingsFields } from "@/features/cleanup/cleanup-settings-fields";
import { ConfirmDeleteModal } from "@/features/cleanup/confirm-delete-modal";
import { useCleanupSettings } from "@/features/cleanup/use-cleanup-settings";

const actionCopy: Record<
  CleanupAction,
  { body: string; confirmLabel: string; title: string }
> = {
  save: {
    body: "These settings control automatic history deletion. Better History will delete eligible visits according to this schedule.",
    confirmLabel: "Save settings",
    title: "Confirm cleanup settings",
  },
  "run-now": {
    body: "Better History will immediately delete visits older than your retention window. This cannot be undone.",
    confirmLabel: "Run cleanup",
    title: "Run cleanup now?",
  },
};

/**
 * Render schedule and retention controls for automatic history cleanup.
 * @returns The cleanup schedule and retention settings form.
 */
export const CleanupForm = () => {
  const {
    closeModal,
    confirmAction,
    draft,
    formState,
    query,
    requestAction,
    updateDraft,
  } = useCleanupSettings();

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

  const pendingCopy = formState.pendingAction
    ? actionCopy[formState.pendingAction]
    : null;

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

      <CleanupSettingsFields draft={draft} onChange={updateDraft} />

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
            requestAction("run-now");
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
            requestAction("save");
          }}
          type="button"
        >
          Save cleanup settings
        </button>
      </div>

      {pendingCopy && (
        <ConfirmDeleteModal
          body={pendingCopy.body}
          confirmLabel={pendingCopy.confirmLabel}
          isBusy={formState.isWorking}
          onClose={closeModal}
          onConfirm={() => {
            void confirmAction();
          }}
          title={pendingCopy.title}
        />
      )}
    </div>
  );
};

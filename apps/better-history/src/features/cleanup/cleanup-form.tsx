import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Result } from "better-result";
import { useEffect, useState } from "react";
import { ConfirmDeleteModal } from "@/features/cleanup/confirm-delete-modal";
import { extensionMessaging } from "@/lib/messages";
import { Cleanup, type Cleanup as CleanupConfig } from "@/lib/schemas";
import { readKeyOr, writeKey } from "@/lib/storage";

const DEFAULT_CLEANUP = Cleanup.parse({});

const SCHEDULES: Array<{
  description: string;
  label: string;
  value: CleanupConfig["schedule"];
}> = [
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

const RETENTIONS: Array<{
  description: string;
  label: string;
  value: CleanupConfig["retention"];
}> = [
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

function formatLastRun(lastRunAt: number | undefined) {
  if (lastRunAt === undefined) {
    return "Never run";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(lastRunAt);
}

function optionClasses(isSelected: boolean) {
  return [
    "rounded-xl border p-4 text-left transition",
    isSelected
      ? "border-zinc-900 bg-zinc-950 text-white shadow-lg shadow-zinc-950/10 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900",
  ].join(" ");
}

export function CleanupForm() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CleanupConfig>(DEFAULT_CLEANUP);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["cleanup"],
    queryFn: async (): Promise<CleanupConfig> => {
      const result = await readKeyOr("cleanup", DEFAULT_CLEANUP);
      if (Result.isError(result)) {
        throw result.error;
      }
      return result.value;
    },
  });

  useEffect(() => {
    if (query.data && !isDirty) {
      setDraft(query.data);
    }
  }, [query.data, isDirty]);

  const updateDraft = (updater: (current: CleanupConfig) => CleanupConfig) => {
    setDraft(updater);
    setIsDirty(true);
  };

  const closeModal = () => {
    if (!isWorking) {
      setPendingAction(null);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) {
      return;
    }

    setIsWorking(true);
    setError(null);
    setStatus(null);

    try {
      if (pendingAction === "save") {
        const result = await writeKey("cleanup", draft);
        if (Result.isError(result)) {
          throw result.error;
        }
        setIsDirty(false);
        await queryClient.invalidateQueries({ queryKey: ["cleanup"] });
        setStatus("Cleanup settings saved.");
      } else {
        const response = await extensionMessaging.sendMessage(
          "cleanup.runNow",
          {}
        );
        await queryClient.invalidateQueries({ queryKey: ["cleanup"] });
        setStatus(`Cleanup finished at ${formatLastRun(response.lastRunAt)}.`);
      }
      setPendingAction(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsWorking(false);
    }
  };

  if (query.isPending) {
    return <p className="text-sm text-zinc-500">Loading cleanup settings…</p>;
  }

  if (query.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
        Failed to load cleanup settings: {String(query.error)}
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.16),transparent_34%),linear-gradient(135deg,#ffffff,#fafafa)] p-6 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.22),transparent_34%),linear-gradient(135deg,#09090b,#18181b)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="font-semibold text-rose-600 text-xs uppercase tracking-[0.24em] dark:text-rose-400">
              Smart cleanup
            </p>
            <div className="space-y-2">
              <h2 className="font-semibold text-3xl tracking-tight">
                Prune old history without touching the places you trust.
              </h2>
              <p className="max-w-2xl text-sm text-zinc-600 leading-6 dark:text-zinc-400">
                Choose how often Better History should remove older visits, how
                much recent history to keep, and whether whitelisted domains are
                preserved during cleanup.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4 text-sm shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
            <p className="text-zinc-500">Last cleanup</p>
            <p className="mt-1 font-medium">{formatLastRun(draft.lastRunAt)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold text-lg">Schedule</h3>
          <p className="text-sm text-zinc-500">
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
                onChange={() =>
                  updateDraft((current) => ({
                    ...current,
                    schedule: option.value,
                  }))
                }
                type="radio"
              />
              <span className="font-medium text-sm">{option.label}</span>
              <span className="mt-2 block text-xs leading-5 opacity-75">
                {option.description}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold text-lg">Retention</h3>
          <p className="text-sm text-zinc-500">
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
                onChange={() =>
                  updateDraft((current) => ({
                    ...current,
                    retention: option.value,
                  }))
                }
                type="radio"
              />
              <span className="font-medium text-sm">{option.label}</span>
              <span className="mt-2 block text-xs leading-5 opacity-75">
                {option.description}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block font-medium text-sm">
              Exempt whitelisted domains
            </span>
            <span className="mt-1 block text-sm text-zinc-500 leading-6">
              When enabled, cleanup preserves visits matching your whitelist
              rules even if they are older than the retention window.
            </span>
          </span>
          <input
            checked={draft.whitelistExempt}
            className="mt-1 size-5 accent-zinc-900 dark:accent-zinc-100"
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                whitelistExempt: event.target.checked,
              }))
            }
            type="checkbox"
          />
        </label>
      </section>

      {(status || error) && (
        <div
          className={
            error
              ? "rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 text-sm dark:border-red-950 dark:bg-red-950/30 dark:text-red-300"
              : "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 text-sm dark:border-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-300"
          }
        >
          {error ?? status}
        </div>
      )}

      <div className="flex flex-col gap-2 border-zinc-200 border-t pt-5 sm:flex-row sm:justify-end dark:border-zinc-800">
        <button
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          disabled={isWorking || isDirty}
          onClick={() => setPendingAction("run-now")}
          title={
            isDirty ? "Save your changes before running cleanup." : undefined
          }
          type="button"
        >
          Run now
        </button>
        <button
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          disabled={!isDirty || isWorking}
          onClick={() => setPendingAction("save")}
          type="button"
        >
          Save cleanup settings
        </button>
      </div>

      {pendingAction && (
        <ConfirmDeleteModal
          body={
            pendingAction === "save"
              ? "These settings control automatic history deletion. Better History will delete eligible visits according to this schedule."
              : "Better History will immediately delete visits older than your retention window. This cannot be undone."
          }
          confirmLabel={
            pendingAction === "save" ? "Save settings" : "Run cleanup"
          }
          isBusy={isWorking}
          onClose={closeModal}
          onConfirm={confirmAction}
          title={
            pendingAction === "save"
              ? "Confirm cleanup settings"
              : "Run cleanup now?"
          }
        />
      )}
    </div>
  );
}

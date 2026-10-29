import type { Cleanup } from "@/lib/schemas";

const SCHEDULES: {
  description: string;
  label: string;
  value: Cleanup["schedule"];
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
  value: Cleanup["retention"];
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

const optionClasses = (isSelected: boolean) =>
  [
    "rounded-xl border p-4 text-left transition",
    isSelected
      ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/10 dark:border-border dark:bg-muted dark:text-foreground"
      : "border-border bg-card hover:border-border hover:bg-muted dark:border-border dark:bg-card dark:hover:border-border dark:hover:bg-muted",
  ].join(" ");

interface CleanupSettingsFieldsProps {
  draft: Cleanup;
  onChange: (updater: (current: Cleanup) => Cleanup) => void;
}

/**
 * Render the schedule, retention, and whitelist controls.
 * @returns The cleanup settings inputs.
 */
export const CleanupSettingsFields = ({
  draft,
  onChange,
}: CleanupSettingsFieldsProps) => (
  <>
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
                onChange((current) => ({ ...current, schedule: option.value }));
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
                onChange((current) => ({
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
            When enabled, cleanup preserves visits matching your whitelist rules
            even if they are older than the retention window.
          </span>
        </span>
        <input
          checked={draft.whitelistExempt}
          className="accent-primary dark:accent-primary mt-1 size-5"
          onChange={(event) => {
            onChange((current) => ({
              ...current,
              whitelistExempt: event.target.checked,
            }));
          }}
          type="checkbox"
        />
      </label>
    </section>
  </>
);

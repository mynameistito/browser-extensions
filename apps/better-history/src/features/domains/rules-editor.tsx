import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { PatternKindSchema } from "@/lib/schemas";
import type { DomainRule } from "@/lib/schemas";

const KIND_LABELS: Record<DomainRule["kind"], string> = {
  exact: "Exact domain",
  page: "Exact page",
  path: "Path prefix",
  "specific-sub": "Specific subdomain",
  subdomain: "Domain + subdomains",
};

interface Props {
  onChange: (next: DomainRule[]) => void | Promise<void>;
  rules: DomainRule[];
  title: string;
}

const NEWLINE = /\r?\n/u;

const saveRules = async (
  savingRef: { current: boolean },
  setIsSaving: (value: boolean) => void,
  setSaveError: (value: string | null) => void,
  onChange: Props["onChange"],
  next: DomainRule[],
  errorMessage: string,
  onSuccess?: () => void
): Promise<void> => {
  if (savingRef.current) {
    return;
  }

  savingRef.current = true;
  setIsSaving(true);
  setSaveError(null);

  try {
    await onChange(next);
    onSuccess?.();
  } catch {
    setSaveError(errorMessage);
  } finally {
    savingRef.current = false;
    setIsSaving(false);
  }
};

/**
 * Edit domain matching rules and save validated changes.
 * @param props - Rule list, label, and save callback.
 * @returns The domain rules editor.
 */
export const RulesEditor = ({ title, rules, onChange }: Props) => {
  const [pattern, setPattern] = useState("");
  const [kind, setKind] = useState<DomainRule["kind"]>("subdomain");
  const [bulk, setBulk] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const add = async () => {
    const p = pattern.trim();

    if (!p) {
      return;
    }

    await saveRules(
      savingRef,
      setIsSaving,
      setSaveError,
      onChange,
      [...rules, { kind, pattern: p }],
      "Could not save the rule. Please try again.",
      () => {
        setPattern("");
      }
    );
  };

  const remove = async (idx: number) => {
    await saveRules(
      savingRef,
      setIsSaving,
      setSaveError,
      onChange,
      rules.filter((_, i) => i !== idx),
      "Could not delete the rule. Please try again."
    );
  };

  const addBulk = async () => {
    const lines = bulk
      .split(NEWLINE)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return;
    }

    const additions: DomainRule[] = lines.map((p) => ({ kind, pattern: p }));
    await saveRules(
      savingRef,
      setIsSaving,
      setSaveError,
      onChange,
      [...rules, ...additions],
      "Could not save the rules. Please try again.",
      () => {
        setBulk("");
      }
    );
  };

  return (
    <div aria-busy={isSaving} className="space-y-6">
      <h2 className="text-xl font-semibold">{title}</h2>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            className="border-border dark:border-border flex-1 rounded-md border bg-transparent px-3 py-1.5 text-sm"
            disabled={isSaving}
            onChange={(e) => {
              setPattern(e.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void add();
              }
            }}
            placeholder="example.com or https://example.com/docs"
            value={pattern}
          />
          <select
            className="border-border dark:border-border rounded-md border bg-transparent px-2 py-1.5 text-sm"
            disabled={isSaving}
            onChange={(e) => {
              const parsedKind = PatternKindSchema.safeParse(e.target.value);

              if (parsedKind.success) {
                setKind(parsedKind.data);
              }
            }}
            value={kind}
          >
            {PatternKindSchema.options.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <button
            className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:text-foreground rounded-md px-3 py-1.5 text-sm"
            disabled={isSaving}
            onClick={() => {
              void add();
            }}
            type="button"
          >
            Add
          </button>
        </div>

        <details className="text-sm">
          <summary className="text-muted-foreground hover:text-foreground dark:hover:text-foreground cursor-pointer">
            Bulk add (one per line)
          </summary>
          <div className="mt-2 space-y-2">
            <textarea
              className="border-border dark:border-border h-24 w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs"
              disabled={isSaving}
              onChange={(e) => {
                setBulk(e.target.value);
              }}
              placeholder={"facebook.com\ntwitter.com\nx.com"}
              value={bulk}
            />
            <button
              className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:text-foreground rounded-md px-3 py-1 text-sm"
              disabled={isSaving}
              onClick={() => {
                void addBulk();
              }}
              type="button"
            >
              Add all (kind: {KIND_LABELS[kind]})
            </button>
          </div>
        </details>
      </div>

      <ul className="divide-border border-border dark:divide-border dark:border-border divide-y rounded-md border">
        {rules.length === 0 ? (
          <li className="text-muted-foreground px-3 py-6 text-center text-sm">
            No rules yet.
          </li>
        ) : (
          rules.map((r, idx) => (
            <li
              className="flex items-center gap-3 px-3 py-2"
              key={`${r.kind}:${r.pattern}`}
            >
              <span className="font-mono text-sm">{r.pattern}</span>
              <span
                className={cn(
                  "bg-muted text-muted-foreground rounded-sm px-1.5 py-0.5 text-xs",
                  "dark:bg-border dark:text-foreground"
                )}
              >
                {KIND_LABELS[r.kind]}
              </span>
              <button
                aria-label="Remove rule"
                className="text-muted-foreground hover:text-destructive ml-auto"
                disabled={isSaving}
                onClick={() => {
                  void remove(idx);
                }}
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))
        )}
      </ul>

      {saveError === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {saveError}
        </p>
      )}
      {isSaving ? (
        <output className="text-muted-foreground text-sm">Saving rules…</output>
      ) : null}
    </div>
  );
};

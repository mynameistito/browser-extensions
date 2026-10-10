import { Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { type DomainRule, PatternKind } from "@/lib/schemas";

const KIND_LABELS: Record<DomainRule["kind"], string> = {
  exact: "Exact domain",
  subdomain: "Domain + subdomains",
  "specific-sub": "Specific subdomain",
  path: "Path prefix",
  page: "Exact page",
};

interface Props {
  onChange: (next: DomainRule[]) => void | Promise<void>;
  rules: DomainRule[];
  title: string;
}

const NEWLINE = /\r?\n/;

export function RulesEditor({ title, rules, onChange }: Props) {
  const [pattern, setPattern] = useState("");
  const [kind, setKind] = useState<DomainRule["kind"]>("subdomain");
  const [bulk, setBulk] = useState("");

  const add = () => {
    const p = pattern.trim();
    if (!p) {
      return;
    }
    Promise.resolve(onChange([...rules, { pattern: p, kind }])).catch(() => {
      // ignore
    });
    setPattern("");
  };

  const remove = (idx: number) => {
    Promise.resolve(onChange(rules.filter((_, i) => i !== idx))).catch(() => {
      // ignore
    });
  };

  const addBulk = () => {
    const lines = bulk
      .split(NEWLINE)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return;
    }
    const additions: DomainRule[] = lines.map((p) => ({ pattern: p, kind }));
    Promise.resolve(onChange([...rules, ...additions])).catch(() => {
      // ignore
    });
    setBulk("");
  };

  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-xl">{title}</h2>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
            onChange={(e) => setPattern(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="example.com or https://example.com/docs"
            value={pattern}
          />
          <select
            className="rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-800"
            onChange={(e) => setKind(e.target.value as DomainRule["kind"])}
            value={kind}
          >
            {PatternKind.options.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <button
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            onClick={add}
            type="button"
          >
            Add
          </button>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            Bulk add (one per line)
          </summary>
          <div className="mt-2 space-y-2">
            <textarea
              className="h-24 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 font-mono text-xs dark:border-zinc-800"
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"facebook.com\ntwitter.com\nx.com"}
              value={bulk}
            />
            <button
              className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
              onClick={addBulk}
              type="button"
            >
              Add all (kind: {KIND_LABELS[kind]})
            </button>
          </div>
        </details>
      </div>

      <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
        {rules.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-zinc-500">
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
                  "rounded-sm bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600",
                  "dark:bg-zinc-800 dark:text-zinc-300"
                )}
              >
                {KIND_LABELS[r.kind]}
              </span>
              <button
                aria-label="Remove rule"
                className="ml-auto text-zinc-400 hover:text-red-600"
                onClick={() => remove(idx)}
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

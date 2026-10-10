import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { VList } from "virtua";
import type { HistoryItem } from "@/features/history/use-history";
import { cn } from "@/lib/cn";

interface Props {
  items: HistoryItem[];
  onDelete: (urls: string[]) => void;
}

export function HistoryList({ items, onDelete }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const allChecked = useMemo(
    () => items.length > 0 && selected.size === items.length,
    [items.length, selected.size]
  );

  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(items.map((i) => i.url)));
  };

  const deleteSelected = () => {
    if (selected.size === 0) {
      return;
    }
    onDelete([...selected]);
    setSelected(new Set());
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-zinc-200 border-b px-4 py-2 dark:border-zinc-800">
        <input
          aria-label="Select all"
          checked={allChecked}
          className="size-4"
          onChange={toggleAll}
          type="checkbox"
        />
        <div className="text-sm text-zinc-500">
          {items.length} result{items.length === 1 ? "" : "s"}
          {selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </div>
        <button
          className={cn(
            "ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-sm",
            selected.size > 0
              ? "bg-red-600 text-white hover:bg-red-700"
              : "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
          )}
          disabled={selected.size === 0}
          onClick={deleteSelected}
          type="button"
        >
          <Trash2 className="size-4" /> Delete
        </button>
      </div>

      <div className="flex-1">
        <VList style={{ height: "100%" }}>
          {items.map((item) => (
            <Row
              checked={selected.has(item.url)}
              item={item}
              key={item.id}
              onToggle={() => toggle(item.url)}
            />
          ))}
        </VList>
      </div>
    </div>
  );
}

function Row({
  item,
  checked,
  onToggle,
}: {
  item: HistoryItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const host = useMemo(() => {
    try {
      return new URL(item.url).host;
    } catch {
      return item.url;
    }
  }, [item.url]);

  return (
    <div className="flex items-center gap-3 border-zinc-100 border-b px-4 py-2 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/50">
      <input
        aria-label="Select item"
        checked={checked}
        className="size-4 shrink-0"
        onChange={onToggle}
        type="checkbox"
      />
      <div className="min-w-0 flex-1">
        <a
          className="block truncate font-medium text-sm hover:underline"
          href={item.url}
          rel="noreferrer"
          target="_blank"
        >
          {item.title}
        </a>
        <div className="truncate text-xs text-zinc-500">{host}</div>
      </div>
      <div className="shrink-0 text-xs text-zinc-400 tabular-nums">
        {format(new Date(item.lastVisitTime), "HH:mm")}
      </div>
    </div>
  );
}

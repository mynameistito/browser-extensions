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

const Row = ({
  item,
  checked,
  onToggle,
}: {
  item: HistoryItem;
  checked: boolean;
  onToggle: () => void;
}) => {
  const host = useMemo(() => {
    try {
      return new URL(item.url).host;
    } catch {
      return item.url;
    }
  }, [item.url]);

  return (
    <div className="border-border hover:bg-muted dark:border-border dark:hover:bg-accent/50 flex items-center gap-3 border-b px-4 py-2">
      <input
        aria-label="Select item"
        checked={checked}
        className="size-4 shrink-0"
        onChange={onToggle}
        type="checkbox"
      />
      <div className="min-w-0 flex-1">
        <a
          className="block truncate text-sm font-medium hover:underline"
          href={item.url}
          rel="noreferrer"
          target="_blank"
        >
          {item.title}
        </a>
        <div className="text-muted-foreground truncate text-xs">{host}</div>
      </div>
      <div className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {format(new Date(item.lastVisitTime), "HH:mm")}
      </div>
    </div>
  );
};

/**
 * Render a selectable, virtualized list of history entries.
 * @param props - History entries and the selected-entry delete callback.
 * @returns The history list and its selection controls.
 */
export const HistoryList = ({ items, onDelete }: Props) => {
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

  const visibleSelected = useMemo(
    () => items.filter((item) => selected.has(item.url)),
    [items, selected]
  );

  const allChecked =
    items.length > 0 && visibleSelected.length === items.length;

  const toggleAll = () => {
    if (allChecked) {
      setSelected((prev) => {
        const next = new Set(prev);

        for (const item of items) {
          next.delete(item.url);
        }

        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);

        for (const item of items) {
          next.add(item.url);
        }

        return next;
      });
    }
  };

  const deleteSelected = () => {
    const urls = visibleSelected.map((item) => item.url);

    if (urls.length === 0) {
      return;
    }

    onDelete(urls);
    setSelected((prev) => {
      const next = new Set(prev);

      for (const url of urls) {
        next.delete(url);
      }

      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-border dark:border-border flex items-center gap-3 border-b px-4 py-2">
        <input
          aria-label="Select all"
          checked={allChecked}
          className="size-4"
          onChange={toggleAll}
          type="checkbox"
        />
        <div className="text-muted-foreground text-sm">
          {items.length} result{items.length === 1 ? "" : "s"}
          {visibleSelected.length > 0
            ? ` · ${visibleSelected.length} selected`
            : ""}
        </div>
        <button
          className={cn(
            "ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-sm",
            selected.size > 0
              ? "bg-destructive text-primary-foreground hover:bg-destructive/90"
              : "bg-muted text-muted-foreground dark:bg-border cursor-not-allowed"
          )}
          disabled={selected.size === 0}
          onClick={deleteSelected}
          type="button"
        >
          <Trash2 className="size-4" /> Delete
        </button>
      </div>

      <div className="flex-1">
        <VList className="h-full">
          {items.map((item) => (
            <Row
              checked={selected.has(item.url)}
              item={item}
              key={item.id}
              onToggle={() => {
                toggle(item.url);
              }}
            />
          ))}
        </VList>
      </div>
    </div>
  );
};

import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Result } from "better-result";
import { Search } from "lucide-react";
import { z } from "zod";
import { HistoryList } from "@/features/history/history-list";
import { useHistory } from "@/features/history/use-history";
import { history } from "@/lib/browser-api";
import { PRESETS } from "@/lib/ranges";

const search = z.object({
  q: z.string().catch(""),
  preset: z.enum(PRESETS).catch("today"),
});

export const Route = createFileRoute("/")({
  validateSearch: search,
  component: HistoryPage,
});

function renderBody(
  query: ReturnType<typeof useHistory>,
  onDelete: (urls: string[]) => Promise<void>
) {
  if (query.isPending) {
    return <div className="p-6 text-sm text-zinc-500">Loading…</div>;
  }
  if (query.isError) {
    return (
      <div className="p-6 text-red-600 text-sm">{String(query.error)}</div>
    );
  }
  if (query.data.length === 0) {
    return <div className="p-6 text-sm text-zinc-500">No visits.</div>;
  }
  return <HistoryList items={query.data} onDelete={onDelete} />;
}

function HistoryPage() {
  const { q, preset } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const qc = useQueryClient();
  const query = useHistory({ q, preset });

  const onDelete = async (urls: string[]) => {
    for (const url of urls) {
      const r = await history.deleteUrl({ url });
      if (Result.isError(r)) {
        console.error(r.error);
      }
    }
    await qc.invalidateQueries({ queryKey: ["history"] });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-zinc-200 border-b px-4 py-3 dark:border-zinc-800">
        <Search className="size-4 text-zinc-400" />
        <input
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          onChange={(e) => {
            const next = e.target.value;
            navigate({
              to: "/",
              search: { q: next, preset },
              replace: true,
            });
          }}
          placeholder="Search history…"
          value={q}
        />
      </div>

      {renderBody(query, onDelete)}
    </div>
  );
}

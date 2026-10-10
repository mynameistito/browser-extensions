import { useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  getRouteApi,
  useNavigate,
} from "@tanstack/react-router";
import { Result } from "better-result";
import { Search } from "lucide-react";
import { z } from "zod";

import { HistoryList } from "@/features/history/history-list";
import { useHistory } from "@/features/history/use-history";
import { history } from "@/lib/browser-api";
import { PRESETS } from "@/lib/ranges";
import type { Preset } from "@/lib/ranges";

const fallbackPreset = (value: unknown): Preset => {
  const parsed = z.enum(PRESETS).safeParse(value);
  return parsed.success ? parsed.data : "today";
};

const fallbackText = (value: unknown): string =>
  typeof value === "string" ? value : "";

const search = z.object({
  preset: z.unknown().transform((value) => fallbackPreset(value)),
  q: z.unknown().transform((value) => fallbackText(value)),
});

const routeApi = getRouteApi("/");

const renderBody = (
  query: ReturnType<typeof useHistory>,
  onDelete: (urls: string[]) => Promise<void>
) => {
  if (query.isPending) {
    return <div className="p-6 text-sm text-zinc-500">Loading…</div>;
  }
  if (query.isError) {
    return (
      <div className="p-6 text-sm text-red-600">{String(query.error)}</div>
    );
  }
  if (query.data.length === 0) {
    return <div className="p-6 text-sm text-zinc-500">No visits.</div>;
  }
  return <HistoryList items={query.data} onDelete={onDelete} />;
};

const HistoryPage = () => {
  const { q, preset } = routeApi.useSearch();
  const navigate = useNavigate({ from: "/" });
  const qc = useQueryClient();
  const query = useHistory({ preset, q });

  const onDelete = async (urls: string[]) => {
    await Promise.all(
      urls.map(async (url) => {
        const r = await history.deleteUrl({ url });
        if (Result.isError(r)) {
          console.error(r.error);
        }
      })
    );
    await qc.invalidateQueries({ queryKey: ["history"] });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Search className="size-4 text-zinc-400" />
        <input
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          onChange={(e) => {
            const next = e.target.value;
            navigate({
              replace: true,
              search: { preset, q: next },
              to: "/",
            });
          }}
          placeholder="Search history…"
          value={q}
        />
      </div>

      {renderBody(query, onDelete)}
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: HistoryPage,
  validateSearch: search,
});

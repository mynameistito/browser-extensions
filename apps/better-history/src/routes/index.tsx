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

const search = z.object({
  preset: z.enum(PRESETS).catch("today"),
  q: z.string().catch(""),
});

const routeApi = getRouteApi("/");

const renderBody = (
  query: ReturnType<typeof useHistory>,
  onDelete: (urls: string[]) => Promise<void>
) => {
  if (query.isPending) {
    return <div className="text-muted-foreground p-6 text-sm">Loading…</div>;
  }

  if (query.isError) {
    return (
      <div className="text-destructive p-6 text-sm">{String(query.error)}</div>
    );
  }

  if (query.data.length === 0) {
    return <div className="text-muted-foreground p-6 text-sm">No visits.</div>;
  }

  return (
    <HistoryList
      items={query.data}
      onDelete={(urls) => {
        void onDelete(urls);
      }}
    />
  );
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
      <div className="border-border dark:border-border flex items-center gap-2 border-b px-4 py-3">
        <Search className="text-muted-foreground size-4" />
        <input
          className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
          onChange={(e) => {
            const next = e.target.value;
            void navigate({
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

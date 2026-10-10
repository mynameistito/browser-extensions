import { useQuery } from "@tanstack/react-query";
import { Result } from "better-result";
import { history } from "@/lib/browser-api";
import { type Preset, presetRange } from "@/lib/ranges";

export interface HistoryItem {
  id: string;
  lastVisitTime: number;
  title: string;
  url: string;
  visitCount: number;
}

export function useHistory(params: { q: string; preset: Preset }) {
  return useQuery({
    queryKey: ["history", params.q, params.preset],
    queryFn: async (): Promise<HistoryItem[]> => {
      const range = presetRange(params.preset);
      const r = await history.search({
        text: params.q,
        maxResults: 10_000,
        startTime: range.startTime,
        endTime: range.endTime,
      });
      if (Result.isError(r)) {
        throw r.error;
      }
      return r.value
        .filter((i): i is Required<typeof i> & { url: string } =>
          Boolean(i.id && i.url)
        )
        .map((i) => ({
          id: i.id,
          url: i.url,
          title: i.title || i.url,
          lastVisitTime: i.lastVisitTime ?? 0,
          visitCount: i.visitCount ?? 0,
        }));
    },
  });
}

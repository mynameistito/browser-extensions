import { useQuery } from "@tanstack/react-query";
import { Result } from "better-result";

import { history } from "@/lib/browser-api";
import { presetRange } from "@/lib/ranges";
import type { Preset } from "@/lib/ranges";

export interface HistoryItem {
  id: string;
  lastVisitTime: number;
  title: string;
  url: string;
  visitCount: number;
}

export const useHistory = (params: { q: string; preset: Preset }) =>
  useQuery({
    queryFn: async (): Promise<HistoryItem[]> => {
      const range = presetRange(params.preset);
      const r = await history.search({
        endTime: range.endTime,
        maxResults: 10_000,
        startTime: range.startTime,
        text: params.q,
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
          lastVisitTime: i.lastVisitTime ?? 0,
          title: i.title || i.url,
          url: i.url,
          visitCount: i.visitCount ?? 0,
        }));
    },
    queryKey: ["history", params.q, params.preset],
  });

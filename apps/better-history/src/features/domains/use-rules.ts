import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Result } from "better-result";
import { useCallback } from "react";

import type { DomainRule } from "@/lib/schemas";
import { readKeyOr, writeKey } from "@/lib/storage";

type Key = "blacklist" | "whitelist";

/**
 * Load and persist one blacklist or whitelist.
 * @param key - Storage key for the selected rule list.
 * @returns The query state and a callback for saving rules.
 */
export const useRules = (key: Key) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryFn: async (): Promise<DomainRule[]> => {
      const r = await readKeyOr(key, []);

      if (Result.isError(r)) {
        throw r.error;
      }

      return r.value;
    },
    queryKey: ["rules", key],
  });

  const save = useCallback(
    async (next: DomainRule[]) => {
      const r = await writeKey(key, next);

      if (Result.isError(r)) {
        throw r.error;
      }

      await qc.invalidateQueries({ queryKey: ["rules", key] });
    },
    [key, qc]
  );

  return { ...query, save };
};

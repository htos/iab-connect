"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { deleteSponsor, sponsorsKeys } from "../api/sponsors-api";

/**
 * Delete mutation for a sponsor. On success it invalidates the sponsors list
 * query (E21-S1 invalidation convention), which refetches the list — replacing
 * the old manual refetch-after-delete.
 */
export function useDeleteSponsor() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteSponsor(api, id);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sponsorsKeys.all }),
  });
}

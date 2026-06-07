"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { deleteSupplier, suppliersKeys } from "../api/suppliers-api";

/**
 * Delete mutation for a supplier. On success it invalidates the suppliers list
 * query (E21-S1 invalidation convention), which refetches the list — replacing
 * the old manual refetch-after-delete.
 */
export function useDeleteSupplier() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteSupplier(api, id);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: suppliersKeys.all }),
  });
}

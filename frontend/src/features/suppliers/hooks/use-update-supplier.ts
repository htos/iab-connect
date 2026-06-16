"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { suppliersKeys, updateSupplier } from "../api/suppliers-api";
import type { UpdateSupplierRequest } from "../types/supplier.types";

/**
 * Update mutation for a supplier (form sub-recipe, E22-S4). Throws on API error
 * for the form banner; invalidates both the detail and the list on success.
 */
export function useUpdateSupplier(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateSupplierRequest) => {
      const result = await updateSupplier(api, id, body);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suppliersKeys.all });
      queryClient.invalidateQueries({ queryKey: suppliersKeys.detail(id) });
    },
  });
}

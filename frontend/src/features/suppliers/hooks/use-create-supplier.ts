"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { createSupplier, suppliersKeys } from "../api/suppliers-api";
import type { CreateSupplierRequest } from "../types/supplier.types";

/**
 * Create mutation for a supplier (form sub-recipe, E22-S4). Throws on API error
 * so the form banner shows `mutation.error.message`; invalidates the list on
 * success.
 */
export function useCreateSupplier() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateSupplierRequest) => {
      const result = await createSupplier(api, body);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: suppliersKeys.all }),
  });
}

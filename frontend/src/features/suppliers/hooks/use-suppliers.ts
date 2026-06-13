"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { fetchSuppliers, suppliersKeys } from "../api/suppliers-api";

/**
 * Server state for the suppliers list (E21-S3 — the codebase's first TanStack
 * Query adopter). `enabled` mirrors the page's admin/auth gate so no fetch fires
 * for non-admins. The server-side `status` filter is part of the query key;
 * client-side search stays in the component.
 */
export function useSuppliers(status: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: suppliersKeys.list(status),
    queryFn: async () => {
      const result = await fetchSuppliers(api, status);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled,
  });
}

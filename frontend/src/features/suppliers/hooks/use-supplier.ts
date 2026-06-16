"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { getSupplier, suppliersKeys } from "../api/suppliers-api";

/**
 * Sentinel error so the detail component can render the dedicated
 * `suppliers.notFound` message for a 404 (vs a generic error), preserving the
 * god-page's two-branch error UI (A79). Mirrors `SponsorNotFoundError`.
 */
export class SupplierNotFoundError extends Error {
  constructor() {
    super("suppliers.notFound");
    this.name = "SupplierNotFoundError";
  }
}

/**
 * Detail server state (E22-S4). `enabled` mirrors the admin-only gate so no GET
 * fires for non-admins. A 404 throws `SupplierNotFoundError`.
 */
export function useSupplier(id: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    queryKey: suppliersKeys.detail(id),
    queryFn: async () => {
      const result = await getSupplier(api, id);
      if (result.status === 404) throw new SupplierNotFoundError();
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: enabled && !!id,
  });
}

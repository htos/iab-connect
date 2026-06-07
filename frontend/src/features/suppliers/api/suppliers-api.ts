// Suppliers feature API — encapsulates all endpoint URLs (E21-S1 rule 5: no raw
// `/api/v1/...` strings in components). Uses the E21-S1 DEC-1 client contract:
// the `useApiClient()` hook instance ({ data, error, status }, never throws).
import type { useApiClient } from "@/lib/auth";
import type { SupplierListDto } from "../types/supplier.types";

type SuppliersApiClient = ReturnType<typeof useApiClient>;

const SUPPLIERS_BASE = "/api/v1/suppliers";

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy).
 * `list` is keyed by the server-side `status` filter only; client-side search
 * is NOT part of the key (it filters already-fetched data).
 */
export const suppliersKeys = {
  all: ["suppliers"] as const,
  list: (status: string) => ["suppliers", "list", { status }] as const,
  detail: (id: string) => ["suppliers", "detail", id] as const,
};

export function fetchSuppliers(api: SuppliersApiClient, status: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return api.get<SupplierListDto[]>(`${SUPPLIERS_BASE}${query}`);
}

export function deleteSupplier(api: SuppliersApiClient, id: string) {
  return api.delete<void>(`${SUPPLIERS_BASE}/${id}`);
}

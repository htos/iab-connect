// Suppliers feature API — encapsulates all endpoint URLs (E21-S1 rule 5: no raw
// `/api/v1/...` strings in components). Uses the E21-S1 DEC-1 client contract:
// the `useApiClient()` hook instance ({ data, error, status }, never throws).
import type { useApiClient } from "@/lib/auth";
import type {
  AddLinkRequest,
  CreateSupplierRequest,
  SupplierDetailDto,
  SupplierListDto,
  SupplierStatus,
  UpdateSupplierRequest,
} from "../types/supplier.types";

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

// --- Detail + form endpoints (E22-S4) — same URLs/payloads as the god-pages,
// relocated here so route files carry no raw `/api/v1/...` strings. Suppliers
// have NO packages (unlike sponsors); contract links only. ---

export function getSupplier(api: SuppliersApiClient, id: string) {
  return api.get<SupplierDetailDto>(`${SUPPLIERS_BASE}/${id}`);
}

export function createSupplier(
  api: SuppliersApiClient,
  body: CreateSupplierRequest
) {
  return api.post<SupplierDetailDto>(SUPPLIERS_BASE, body);
}

export function updateSupplier(
  api: SuppliersApiClient,
  id: string,
  body: UpdateSupplierRequest
) {
  return api.put<SupplierDetailDto>(`${SUPPLIERS_BASE}/${id}`, body);
}

export function updateSupplierStatus(
  api: SuppliersApiClient,
  id: string,
  status: SupplierStatus
) {
  return api.put<SupplierDetailDto>(`${SUPPLIERS_BASE}/${id}/status`, {
    status,
  });
}

export function addLink(
  api: SuppliersApiClient,
  id: string,
  body: AddLinkRequest
) {
  return api.post<SupplierDetailDto>(`${SUPPLIERS_BASE}/${id}/links`, body);
}

export function removeLink(
  api: SuppliersApiClient,
  id: string,
  linkId: string
) {
  return api.delete<SupplierDetailDto>(
    `${SUPPLIERS_BASE}/${id}/links/${linkId}`
  );
}

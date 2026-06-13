"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { receivablesKeys, receivablesUrls } from "../api/receivables-api";
import { financeKeys } from "../api/finance-api";
import type {
  InvoiceActivityArea,
  InvoiceTaxCode,
  MemberLookup,
} from "../types/receivables.types";

function parseItems<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  return ((d as { items?: T[] })?.items ?? []) as T[];
}

/**
 * Invoice-form tax-codes lookup. The god-page only set state on `!res.error` and filtered
 * to `isActive` client-side; preserved here (active-only result, swallow errors).
 */
export function useInvoiceTaxCodes(enabled: boolean) {
  const api = useApiClient();
  return useQuery<InvoiceTaxCode[]>({
    queryKey: financeKeys.taxCodes(),
    enabled,
    queryFn: async () => {
      const res = await api.get<InvoiceTaxCode[]>(receivablesUrls.taxCodes());
      if (res.error) return [];
      return parseItems<InvoiceTaxCode>(res.data).filter((tc) => tc.isActive);
    },
  });
}

/**
 * Invoice-form activity-areas lookup. God-page parity: active-only, sorted by sortOrder.
 */
export function useInvoiceActivityAreas(enabled: boolean) {
  const api = useApiClient();
  return useQuery<InvoiceActivityArea[]>({
    queryKey: financeKeys.activityAreas(),
    enabled,
    queryFn: async () => {
      const res = await api.get<InvoiceActivityArea[]>(
        receivablesUrls.activityAreas()
      );
      if (res.error) return [];
      return parseItems<InvoiceActivityArea>(res.data)
        .filter((a) => a.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },
  });
}

/**
 * Members lookup (recipient dropdown). GET /api/v1/members?pageSize=500. Only fetched
 * when `enabled` (the content enables it when recipientType === "Member"). Non-critical:
 * swallow errors → empty list (god-page parity).
 */
export function useMemberLookup(enabled: boolean) {
  const api = useApiClient();
  return useQuery<MemberLookup[]>({
    queryKey: receivablesKeys.members(),
    enabled,
    queryFn: async () => {
      const res = await api.get<{ items: MemberLookup[]; totalCount: number }>(
        receivablesUrls.members()
      );
      if (res.error) return [];
      const data = res.data as { items?: MemberLookup[] } | null;
      return data?.items ?? [];
    },
  });
}

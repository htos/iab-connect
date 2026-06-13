"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { financeKeys, financeUrls } from "../api/finance-api";
import type { ActivityArea, Category, TaxCode } from "../types/finance.types";

/**
 * Shared read-lookups OWNED by the finance foundation (S2). The journal-entries +
 * posting-mappings content consume these; S4 (categories/activity-areas CRUD) and S6
 * (settings/tax-codes CRUD) REUSE these GET hooks rather than redeclaring (A62/A101).
 * Each is tolerant of a raw array OR `{ items }` (god-page parity) and swallows lookup
 * errors (the god-pages only set state on `!res.error`, never surfacing a lookup error).
 */

function parseList<T>(d: unknown): T[] {
  return Array.isArray(d) ? (d as T[]) : ((d as { items?: T[] })?.items ?? []);
}

/** Tax-codes GET list (lookup). S6 owns tax-codes CRUD in its own settings-api.ts. */
export function useTaxCodes(enabled: boolean) {
  const api = useApiClient();
  return useQuery<TaxCode[]>({
    queryKey: financeKeys.taxCodes(),
    enabled,
    queryFn: async () => {
      const res = await api.get(financeUrls.taxCodes());
      if (res.error) return [];
      return parseList<TaxCode>(res.data);
    },
  });
}

/** Activity-areas GET list (lookup). S4 adds the `/report` builder; CRUD builders are
 * owned by the foundation. */
export function useActivityAreas(enabled: boolean) {
  const api = useApiClient();
  return useQuery<ActivityArea[]>({
    queryKey: financeKeys.activityAreas(),
    enabled,
    queryFn: async () => {
      const res = await api.get(financeUrls.activityAreas());
      if (res.error) return [];
      return parseList<ActivityArea>(res.data);
    },
  });
}

/** Categories GET list (lookup). S4 owns categories CRUD in budgeting-api.ts. */
export function useCategories(enabled: boolean) {
  const api = useApiClient();
  return useQuery<Category[]>({
    queryKey: financeKeys.categories(),
    enabled,
    queryFn: async () => {
      const res = await api.get(financeUrls.categories());
      if (res.error) return [];
      return parseList<Category>(res.data);
    },
  });
}

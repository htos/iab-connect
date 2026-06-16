"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { budgetingKeys, budgetingUrls } from "../api/budgeting-api";
import type { FiscalPeriodOption } from "../types/budgeting.types";
import type { ActivityArea } from "../types/budgeting.types";

/**
 * The budget/budget-vs-actual dialog selectors. The god-pages GET `/activity-areas` +
 * `/fiscal-periods` in parallel; the area list is filtered to `isActive` ones (only active
 * cost-centers are selectable). Both read the `{ items }` envelope; lookup errors are
 * swallowed (the god-page only sets state on `res.data`, never surfacing a selector error).
 * `enabled` mirrors the `!authLoading && canReadFinance` gate.
 */

/** Active activity-areas (cost-centers) for the budget/report selectors. */
export function useActiveActivityAreaOptions(enabled: boolean) {
  const api = useApiClient();
  return useQuery<ActivityArea[]>({
    queryKey: budgetingKeys.activityAreas(),
    enabled,
    queryFn: async () => {
      const res = await api.get<unknown>(budgetingUrls.activityAreas());
      if (res.error || !res.data) return [];
      const body = res.data as { items?: ActivityArea[] };
      return (body.items ?? []).filter((a) => a.isActive);
    },
  });
}

/** Fiscal-period options for the budget/report selectors (unfiltered list). */
export function useFiscalPeriodOptions(enabled: boolean) {
  const api = useApiClient();
  return useQuery<FiscalPeriodOption[]>({
    queryKey: budgetingKeys.fiscalPeriods(),
    enabled,
    queryFn: async () => {
      const res = await api.get<unknown>(budgetingUrls.fiscalPeriods());
      if (res.error || !res.data) return [];
      const body = res.data as { items?: FiscalPeriodOption[] };
      return body.items ?? [];
    },
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { budgetingKeys, budgetingUrls } from "../api/budgeting-api";
import type {
  ActivityArea,
  ActivityAreaReport,
} from "../types/budgeting.types";

/**
 * Activity-areas MANAGE list. The god-page GETs `/activity-areas`, reads the `{ items }`
 * envelope, and sorts by `sortOrder`. On `res.error` it sets the `error` banner (the
 * content maps a query error to `res.error`/loadError). `enabled` mirrors the
 * `!authLoading && canReadFinance` gate so NO finance GET fires for a read-denied user.
 *
 * NOTE: the activity-areas page-local type is byte-identical to the foundation
 * `ActivityArea` (id/name/code/description/color/isActive/sortOrder) — reused (DEC-2).
 */
export function useActivityAreasList(enabled: boolean) {
  const api = useApiClient();
  return useQuery<ActivityArea[]>({
    queryKey: budgetingKeys.activityAreas(),
    enabled,
    queryFn: async () => {
      const res = await api.get<ActivityArea[]>(budgetingUrls.activityAreas());
      if (res.error) throw new Error(res.error);
      const body = res.data as unknown as { items?: ActivityArea[] };
      return (body?.items ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
    },
  });
}

export interface SaveActivityAreaVars {
  editingId: string | null;
  name: string;
  code: string;
  description: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

/**
 * Create/update an activity-area. CREATE POSTs a payload that OMITS `isActive`; EDIT PUTs
 * `/{id}` WITH `isActive`. `description`/`color` are mapped "" → null (the god-page sends
 * `form.x || null`). On `res.error` it THROWS — the content's onError maps to the
 * HARDCODED-ENGLISH "Failed to save activity area" (NOT translated). On success the content
 * sets the `updateSuccess`/`createSuccess` i18n key + closes the dialog (A92).
 */
export function useSaveActivityArea() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: SaveActivityAreaVars) => {
      const payload = {
        name: vars.name,
        code: vars.code,
        description: vars.description || null,
        color: vars.color || null,
        sortOrder: vars.sortOrder,
        ...(vars.editingId ? { isActive: vars.isActive } : {}),
      };
      if (vars.editingId) {
        const res = await api.put(
          budgetingUrls.activityArea(vars.editingId),
          payload
        );
        if (res.error) throw new Error(res.error);
      } else {
        const res = await api.post(budgetingUrls.activityAreas(), payload);
        if (res.error) throw new Error(res.error);
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: budgetingKeys.activityAreas(),
      }),
  });
}

/**
 * Toggle-active = PUT to the SAME `/activity-areas/{id}` with the full payload, `isActive`
 * flipped (NOT a dedicated endpoint). On `res.error` THROWS — the content maps to the
 * HARDCODED-ENGLISH "Failed to toggle activity area status".
 */
export function useToggleActivityAreaActive() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (area: ActivityArea) => {
      const payload = {
        name: area.name,
        code: area.code,
        description: area.description,
        color: area.color,
        sortOrder: area.sortOrder,
        isActive: !area.isActive,
      };
      const res = await api.put(budgetingUrls.activityArea(area.id), payload);
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: budgetingKeys.activityAreas(),
      }),
  });
}

/**
 * Delete an activity-area. On `res.error` THROWS — the content maps to the
 * HARDCODED-ENGLISH "Failed to delete activity area"; the inline confirm state is preserved
 * on failure (the content only clears `confirmDeleteId` in the success path).
 */
export function useDeleteActivityArea() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(budgetingUrls.activityArea(id));
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: budgetingKeys.activityAreas(),
      }),
  });
}

/**
 * Activity-areas ON-DEMAND report (`/report?from=&to=`). The god-page fetches only when the
 * Filter button is clicked (a manual handler) — modelled as a query `enabled` only when
 * `fetch` is armed. On `res.error` the content shows the HARDCODED-ENGLISH "Failed to load
 * report". The rows are SERVER-supplied; the content only sums them + picks the colour.
 */
export function useActivityAreaReport(params: {
  from: string;
  to: string;
  fetch: boolean;
}) {
  const api = useApiClient();
  return useQuery<ActivityAreaReport[]>({
    queryKey: budgetingKeys.activityAreaReport(params.from, params.to),
    enabled: params.fetch,
    queryFn: async () => {
      const res = await api.get<ActivityAreaReport[]>(
        budgetingUrls.activityAreaReport(params.from, params.to)
      );
      if (res.error) throw new Error(res.error);
      return (res.data as ActivityAreaReport[]) ?? [];
    },
  });
}

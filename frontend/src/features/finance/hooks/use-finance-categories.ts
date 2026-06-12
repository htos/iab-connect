"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { budgetingKeys, budgetingUrls } from "../api/budgeting-api";
import type {
  CategoryFormValues,
  FinanceCategory,
} from "../types/budgeting.types";

/**
 * Finance categories list. The god-page GETs `/categories` and reads the `{ items }`
 * envelope; on `res.error` it THROWS into its catch → the `loadError` i18n key (NOT a
 * hardcoded string here, unlike activity-areas). NOTE the OUTLIER guard: the categories
 * page reads `canReadFinance` only (NO isLoading wait) and `router.replace("/")` for a
 * denied user — the content owns that guard; `enabled` here gates the GET on `canReadFinance`.
 */
export function useFinanceCategories(enabled: boolean) {
  const api = useApiClient();
  return useQuery<FinanceCategory[]>({
    queryKey: budgetingKeys.categories(),
    enabled,
    queryFn: async () => {
      const res = await api.get(budgetingUrls.categories());
      if (res.error) throw new Error(res.error);
      const body = res.data as { items?: FinanceCategory[] };
      return body?.items ?? [];
    },
  });
}

/**
 * Create/update a category. The god-page does NOT inspect `res.error` (it only catches a
 * REAL rejected promise → the `saveError` i18n key). So the mutationFn does NOT throw on
 * `res.error`; it awaits the call and lets a rejection bubble (matching the god-page's
 * try/catch). On success the content closes the modal + the list invalidates (A92).
 */
export function useSaveCategory() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      editingId: string | null;
      form: CategoryFormValues;
    }) => {
      if (vars.editingId) {
        await api.put(budgetingUrls.category(vars.editingId), vars.form);
      } else {
        await api.post(budgetingUrls.categories(), vars.form);
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: budgetingKeys.categories() }),
  });
}

/**
 * Delete a category. Same swallow as save — the god-page catches only a real rejection →
 * the `deleteError` i18n key. On success the content closes the modal + the list invalidates.
 */
export function useDeleteCategory() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(budgetingUrls.category(id));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: budgetingKeys.categories() }),
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { settingsKeys, settingsUrls } from "../api/settings-api";
import type { TaxCode, TaxCodePayload } from "../types/settings.types";
import type { TaxCodeFormValues } from "../schemas/tax-code.schema";

/**
 * Tax-codes CRUD (E26-S6). The list reads the `{ items }` GET envelope (god-page parity). The
 * rate ×100/÷100 round-trip (load-bearing) is mapped HERE at the hook boundary: the form value
 * is the human percentage; `taxCodeFormToPayload` divides by 100 for the wire so a stored 0.077
 * → form 7.7 → wire 0.077 (a no-touch edit-save re-submits the original). The ÷100 must NOT be
 * dropped.
 */

export function useTaxCodesQuery(enabled: boolean) {
  const api = useApiClient();
  return useQuery<TaxCode[]>({
    queryKey: settingsKeys.taxCodes(),
    enabled,
    queryFn: async () => {
      const res = await api.get<TaxCode[]>(settingsUrls.taxCodes());
      if (res.error) throw new Error(res.error);
      const body = res.data as unknown as { items?: TaxCode[] };
      return body?.items ?? [];
    },
  });
}

/** Map the form (human percentage) to the wire payload (÷100 fraction). A96: no .trim(). */
export function taxCodeFormToPayload(
  values: TaxCodeFormValues
): TaxCodePayload {
  return {
    code: values.code,
    label: values.label,
    rate: values.rate / 100,
    isDefault: values.isDefault,
  };
}

export function useSaveTaxCode() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { id: string | null; values: TaxCodeFormValues }
  >({
    mutationFn: async ({ id, values }) => {
      const payload = taxCodeFormToPayload(values);
      const res = id
        ? await api.put(settingsUrls.taxCode(id), payload)
        : await api.post(settingsUrls.taxCodes(), payload);
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.taxCodes() }),
  });
}

export function useDeleteTaxCode() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const res = await api.delete(settingsUrls.taxCode(id));
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.taxCodes() }),
  });
}

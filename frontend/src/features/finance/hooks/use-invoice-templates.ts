"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { settingsKeys, settingsUrls } from "../api/settings-api";
import type {
  InvoiceTemplate,
  InvoiceTemplatePayload,
} from "../types/settings.types";
import type { InvoiceTemplateFormValues } from "../schemas/invoice-template.schema";

/**
 * Invoice-templates CRUD (E26-S6). The list reads the `{ items }` GET envelope (god-page parity).
 * A96: the `"" → null` optional mapping for the nullable fields lives HERE at the wire boundary;
 * required strings (name) pass through untrimmed. The create-only `jurisdiction` + edit-locked
 * `countryCode` (A98) are handled in the form/content — the payload is byte-identical.
 */

export function useInvoiceTemplatesQuery(enabled: boolean) {
  const api = useApiClient();
  return useQuery<InvoiceTemplate[]>({
    queryKey: settingsKeys.invoiceTemplates(),
    enabled,
    queryFn: async () => {
      const res = await api.get<InvoiceTemplate[]>(
        settingsUrls.invoiceTemplates()
      );
      if (res.error) throw new Error(res.error);
      const body = res.data as unknown as { items?: InvoiceTemplate[] };
      return body?.items ?? [];
    },
  });
}

/** Map the form to the wire payload. A96: optionals `"" → null`, required `name` untrimmed. */
export function invoiceTemplateFormToPayload(
  values: InvoiceTemplateFormValues
): InvoiceTemplatePayload {
  return {
    name: values.name,
    jurisdiction: values.jurisdiction,
    countryCode: values.countryCode || null,
    isDefault: values.isDefault,
    showVatId: values.showVatId,
    showTaxExemptionNote: values.showTaxExemptionNote,
    taxExemptionNote: values.taxExemptionNote || null,
    showReverseChargeNote: values.showReverseChargeNote,
    reverseChargeNote: values.reverseChargeNote || null,
    showPaymentTerms: values.showPaymentTerms,
    defaultPaymentTerms: values.defaultPaymentTerms || null,
    showBankDetails: values.showBankDetails,
    logoUrl: values.logoUrl || null,
    headerText: values.headerText || null,
    footerText: values.footerText || null,
    legalNotice: values.legalNotice || null,
    language: values.language,
  };
}

export function useSaveInvoiceTemplate() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { id: string | null; values: InvoiceTemplateFormValues }
  >({
    mutationFn: async ({ id, values }) => {
      const payload = invoiceTemplateFormToPayload(values);
      const res = id
        ? await api.put(settingsUrls.invoiceTemplate(id), payload)
        : await api.post(settingsUrls.invoiceTemplates(), payload);
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: settingsKeys.invoiceTemplates(),
      }),
  });
}

export function useDeleteInvoiceTemplate() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const res = await api.delete(settingsUrls.invoiceTemplate(id));
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: settingsKeys.invoiceTemplates(),
      }),
  });
}

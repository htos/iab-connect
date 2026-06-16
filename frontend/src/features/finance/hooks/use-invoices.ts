"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { receivablesKeys, receivablesUrls } from "../api/receivables-api";
import type { InvoiceListRow } from "../types/receivables.types";

function parseItems<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  return ((d as { items?: T[] })?.items ?? []) as T[];
}

/**
 * Invoices list. SERVER-side `?status=&from=&to=` filters are part of the key so the
 * query refetches when the filters change (god-page parity). The god-page set the error
 * banner from `res.error`; the content surfaces `query.error`/`isError` the same way.
 * `enabled` gated on the canonical read guard (isAuthenticated && canReadFinance).
 *
 * A100: Send/Cancel do NOT refetch this list — the content keeps a local status overlay
 * keyed on the active filter (see invoices-page-content). So this query is NOT invalidated
 * by the send/cancel mutations.
 */
export function useInvoices(
  status: string,
  from: string,
  to: string,
  enabled: boolean
) {
  const api = useApiClient();
  return useQuery<InvoiceListRow[]>({
    queryKey: receivablesKeys.invoices(status, from, to),
    enabled,
    queryFn: async () => {
      const res = await api.get<InvoiceListRow[]>(
        receivablesUrls.invoices(
          status || undefined,
          from || undefined,
          to || undefined
        )
      );
      if (res.error) throw new Error(res.error);
      return parseItems<InvoiceListRow>(res.data);
    },
  });
}

/**
 * Send a draft invoice (list page). POST /invoices/{id}/send. A100: NO list invalidation
 * — the content optimistically patches the row status to "Sent" with no refetch. Throws
 * on res.error so the content's onError leaves the local list unchanged.
 */
export function useSendInvoice() {
  const api = useApiClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(receivablesUrls.invoiceSend(id), {});
      if (res.error) throw new Error(res.error);
      return id;
    },
  });
}

/**
 * Cancel an invoice from the LIST page = DELETE /invoices/{id} (divergence vs the detail
 * page's POST /cancel). A100: NO list invalidation — the content patches the row status
 * to "Cancelled" with no refetch.
 */
export function useCancelInvoiceFromList() {
  const api = useApiClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(receivablesUrls.invoice(id));
      if (res.error) throw new Error(res.error);
      return id;
    },
  });
}

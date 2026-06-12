"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { receivablesKeys, receivablesUrls } from "../api/receivables-api";
import type { InvoiceDetail, InvoicePayment } from "../types/receivables.types";

/**
 * Invoice detail query. A99: `retry: false` — the god-page renders a generic load-error
 * card on `res.error` (no not-found sentinel, no retry). `enabled` is `!!id && canRead`.
 */
export function useInvoiceDetail(id: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery<InvoiceDetail>({
    queryKey: receivablesKeys.invoice(id),
    enabled: enabled && !!id,
    retry: false,
    queryFn: async () => {
      const res = await api.get<InvoiceDetail>(receivablesUrls.invoice(id));
      if (res.error || !res.data) throw new Error(res.error || "not-found");
      return res.data as InvoiceDetail;
    },
  });
}

/**
 * Invoice payment history (invoiceId-scoped). The god-page treats this as non-critical
 * (silent on error). retry:false; queryFn returns [] on error so no error surfaces.
 */
export function useInvoicePayments(id: string, enabled: boolean) {
  const api = useApiClient();
  return useQuery<InvoicePayment[]>({
    queryKey: receivablesKeys.invoicePayments(id),
    enabled: enabled && !!id,
    retry: false,
    queryFn: async () => {
      const res = await api.get<{ items: InvoicePayment[] }>(
        receivablesUrls.invoicePayments(id)
      );
      if (res.error) return [];
      const body = res.data as { items?: InvoicePayment[] } | null;
      return body?.items ?? [];
    },
  });
}

/** Send (detail page, Draft only) → POST /send then refetch the invoice detail. */
export function useSendInvoiceDetail(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(receivablesUrls.invoiceSend(id), {});
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: receivablesKeys.invoice(id) }),
  });
}

/**
 * Cancel (detail page) = POST /invoices/{id}/cancel (divergence vs the list DELETE), with
 * NO confirmation (the content fires it immediately). Refetches the detail on success.
 */
export function useCancelInvoiceDetail(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(receivablesUrls.invoiceCancel(id), {});
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: receivablesKeys.invoice(id) }),
  });
}

/**
 * Generate the next dunning level for this invoice. Mirrors the god-page: GET existing
 * dunnings → derive next level (max 3) → POST /dunning with a 14-day due date → refetch
 * the invoice. Kept imperative (the level derivation reads the live dunning list).
 */
export function useGenerateInvoiceDunning(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const dunningRes = await api.get(receivablesUrls.dunning());
      const existing = (dunningRes.data as Array<{ invoiceId: string }>) || [];
      const invoiceDunnings = existing.filter((d) => d.invoiceId === id);
      const nextLevel = Math.min(invoiceDunnings.length + 1, 3);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const res = await api.post(receivablesUrls.dunning(), {
        invoiceId: id,
        level: nextLevel,
        dueDate: dueDate.toISOString(),
      });
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: receivablesKeys.invoice(id) }),
  });
}

/**
 * Invoice create (new page). POST /invoices; on saveAndSend, additionally POST
 * /invoices/{id}/send before navigating. Returns the created id so the content can
 * `router.push` from onSuccess (A92 — navigate on outcome, not synchronously).
 */
export function useCreateInvoice() {
  const api = useApiClient();
  return useMutation({
    mutationFn: async (vars: {
      body: Record<string, unknown>;
      sendAfterCreate: boolean;
    }) => {
      const res = await api.post(receivablesUrls.invoiceCreate(), vars.body);
      if (res.error) throw new Error(res.error);
      const createdId = (res.data as { id: string }).id;
      if (vars.sendAfterCreate) {
        await api.post(receivablesUrls.invoiceSend(createdId), {});
      }
      return createdId;
    },
  });
}

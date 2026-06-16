"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { receivablesKeys, receivablesUrls } from "../api/receivables-api";
import type {
  Payment,
  PaymentFormData,
  PaymentOpenInvoice,
  Receipt,
} from "../types/receivables.types";

/**
 * Payments page composite read: open invoices + payments, loaded together (god-page
 * `loadData` = Promise.all). Each leg has hardcoded-English error strings the content
 * maps from the thrown leg — to preserve "which leg failed" the queries are kept separate
 * and the content surfaces the per-leg English string. `enabled` = canReadFinance.
 */
export function useOpenInvoices(enabled: boolean) {
  const api = useApiClient();
  return useQuery<PaymentOpenInvoice[]>({
    queryKey: receivablesKeys.invoicesOpen(),
    enabled,
    retry: false,
    queryFn: async () => {
      const res = await api.get<PaymentOpenInvoice[]>(
        receivablesUrls.invoicesOpen()
      );
      if (res.error) throw new Error(res.error);
      return (res.data as PaymentOpenInvoice[]) ?? [];
    },
  });
}

export function usePayments(enabled: boolean) {
  const api = useApiClient();
  return useQuery<Payment[]>({
    queryKey: receivablesKeys.payments(),
    enabled,
    retry: false,
    queryFn: async () => {
      const res = await api.get<{ items: Payment[] }>(
        receivablesUrls.payments()
      );
      if (res.error) throw new Error(res.error);
      const body = res.data as { items?: Payment[] } | null;
      return body?.items ?? [];
    },
  });
}

/** Invalidate both payments-related queries after a mutation (god-page `loadData`). */
function invalidatePayments(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: receivablesKeys.payments() });
  queryClient.invalidateQueries({ queryKey: receivablesKeys.invoicesOpen() });
}

/**
 * Create or edit a payment. On create + quickPay, immediately POST /mark-paid. The
 * content drives modal close from onSuccess (A92). Throws on a thrown exception only —
 * the god-page `handleSubmit` does NOT inspect res.error (it awaits put/post directly
 * and only catches throws), so this mirrors that: it does not throw on res.error.
 */
export function useSavePayment() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      editingId: string | null;
      formData: PaymentFormData;
      quickPay: boolean;
    }) => {
      if (vars.editingId) {
        await api.put(receivablesUrls.payment(vars.editingId), vars.formData);
      } else {
        const res = await api.post(receivablesUrls.payments(), vars.formData);
        if (vars.quickPay && res.data && (res.data as Payment).id) {
          await api.post(
            receivablesUrls.paymentMarkPaid((res.data as Payment).id),
            {}
          );
        }
      }
    },
    onSuccess: () => invalidatePayments(queryClient),
  });
}

/**
 * Simple POST/DELETE workflow actions on a payment (submit/approve/mark-paid/delete).
 * The god-page handlers await directly and only catch throws (no res.error inspection),
 * so these do not throw on res.error — they invalidate on completion.
 */
export function usePaymentAction() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      type: "submit" | "approve" | "mark-paid" | "delete";
      id: string;
    }) => {
      switch (vars.type) {
        case "submit":
          await api.post(receivablesUrls.paymentSubmit(vars.id), {});
          break;
        case "approve":
          await api.post(receivablesUrls.paymentApprove(vars.id), {});
          break;
        case "mark-paid":
          await api.post(receivablesUrls.paymentMarkPaid(vars.id), {});
          break;
        case "delete":
          await api.delete(receivablesUrls.payment(vars.id));
          break;
      }
    },
    onSuccess: () => invalidatePayments(queryClient),
  });
}

/** Reject a payment (modal, with reason). god-page awaits POST then reloads. */
export function useRejectPayment() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; reason: string }) => {
      await api.post(receivablesUrls.paymentReject(vars.id), {
        reason: vars.reason,
      });
    },
    onSuccess: () => invalidatePayments(queryClient),
  });
}

/**
 * Attach a receipt to a payment: optionally upload a new file first (FormData file+notes),
 * then POST /payments/{id}/receipt {receiptId}. The god-page DOES inspect res.error here —
 * so this throws on res.error (the content surfaces the verbatim server error and keeps the
 * modal open on failure, A92).
 */
export function useAttachReceipt() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      paymentId: string;
      selectedReceiptId: string;
      file: File | null;
      notes: string;
    }) => {
      let receiptId = vars.selectedReceiptId;
      if (vars.file && !vars.selectedReceiptId) {
        const formData = new FormData();
        formData.append("file", vars.file);
        formData.append("notes", vars.notes);
        const uploadRes = await api.upload<Receipt>(
          receivablesUrls.receipts(),
          formData
        );
        if (uploadRes.error || !uploadRes.data) {
          throw new Error(uploadRes.error || "Upload failed");
        }
        receiptId = (uploadRes.data as Receipt).id;
      }
      if (!receiptId) {
        // god-page returns early (no-op) when nothing selected/uploaded.
        return;
      }
      const res = await api.post(
        receivablesUrls.paymentReceipt(vars.paymentId),
        {
          receiptId,
        }
      );
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () => invalidatePayments(queryClient),
  });
}

/** Detach a receipt from a payment (immediate, no confirm). god-page inspects res.error. */
export function useDetachReceipt() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await api.delete(receivablesUrls.paymentReceipt(paymentId));
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () => invalidatePayments(queryClient),
  });
}

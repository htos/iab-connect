"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/auth";
import { bankingKeys, bankingUrls } from "../api/banking-api";
import type { BankImport, BankImportDetail } from "../types/banking.types";

// Bank-import queries + mutations (E26-S5). BUILD on `useApiClient` (A94): the upload
// mutations call `api.upload(endpoint, formData)` with FormData field `"file"` and NO
// Content-Type — byte-identical to the god-page. The item-action mutations invalidate
// the import-detail query. The POST-vs-PUT `/ignore` split is preserved as TWO hooks
// (`useIgnoreItem` = POST, `useUnmatchItem` = PUT) against the SAME path (DEC-2 = A).

/**
 * Bank-import history list. The god-page reads `{ items }` and throws into its catch on
 * `res.error` (→ the hardcoded-English "Failed to load bank imports" banner; the content
 * surfaces that literal from `isError`). `enabled` mirrors the inline-guard's
 * `if (canReadFinance)` gate so no GET fires for a denied user.
 */
export function useBankImports(enabled: boolean) {
  const api = useApiClient();
  return useQuery<BankImport[]>({
    queryKey: bankingKeys.bankImports(),
    enabled,
    queryFn: async () => {
      const res = await api.get<{ items: BankImport[] }>(
        bankingUrls.bankImports()
      );
      if (res.error) throw new Error(res.error);
      const body = res.data as { items?: BankImport[] };
      return body?.items ?? [];
    },
  });
}

/**
 * Import-detail (items) query. Keyed on the import id; disabled when no import is open
 * (the god-page `viewingImport` local state drives which import is expanded). The
 * item-action mutations invalidate this key to re-fetch the detail (the god-page's
 * `viewImportItems(viewingImport.id)` re-load).
 */
export function useBankImportDetail(importId: string | null) {
  const api = useApiClient();
  return useQuery<BankImportDetail>({
    queryKey: bankingKeys.bankImport(importId ?? "none"),
    enabled: !!importId,
    queryFn: async () => {
      const res = await api.get<BankImportDetail>(
        bankingUrls.bankImport(importId!)
      );
      if (res.error) throw new Error(res.error);
      return res.data as BankImportDetail;
    },
  });
}

/**
 * Single-shot bank-import upload (CSV/mt940). `api.upload` multipart, FormData field
 * `"file"`, Content-Type omitted. A92: the content resets the file input from
 * `onSuccess` (the error path keeps the selected file). Invalidates the list.
 */
export function useUploadBankImport() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.upload(bankingUrls.bankImports(), formData);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: bankingKeys.bankImports() }),
  });
}

/**
 * camt XML upload (auto-triggered on file select). `api.upload` multipart, FormData
 * field `"file"`, Content-Type omitted. Invalidates the list on success.
 */
export function useUploadCamt() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.upload(bankingUrls.bankImportsCamt(), formData);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: bankingKeys.bankImports() }),
  });
}

/** Invalidate the open import-detail (shared by all item-action mutations). */
function invalidateDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  importId: string
) {
  return queryClient.invalidateQueries({
    queryKey: bankingKeys.bankImport(importId),
  });
}

/**
 * Accept the suggested match: PUT .../items/{id}/accept-match { invoiceId }.
 * (A86: the affordance ships green — colour lives in the component.)
 */
export function useAcceptMatch() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      importId: string;
      itemId: string;
      invoiceId: string;
    }) =>
      api.put(
        bankingUrls.bankImportItemAcceptMatch(vars.importId, vars.itemId),
        { invoiceId: vars.invoiceId }
      ),
    onSuccess: (_data, vars) => invalidateDetail(queryClient, vars.importId),
  });
}

/** Reject the suggested match: PUT .../items/{id}/reject-match {}. (A86: red.) */
export function useRejectMatch() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { importId: string; itemId: string }) =>
      api.put(
        bankingUrls.bankImportItemRejectMatch(vars.importId, vars.itemId),
        {}
      ),
    onSuccess: (_data, vars) => invalidateDetail(queryClient, vars.importId),
  });
}

/** Manual match: PUT .../items/{id}/match { paymentId }. */
export function useMatchItem() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      importId: string;
      itemId: string;
      paymentId: string;
    }) =>
      api.put(bankingUrls.bankImportItemMatch(vars.importId, vars.itemId), {
        paymentId: vars.paymentId,
      }),
    onSuccess: (_data, vars) => invalidateDetail(queryClient, vars.importId),
  });
}

/**
 * Ignore an Unmatched item: **POST** .../items/{id}/ignore {} (handleIgnore).
 * DEC-2 = A — the POST vs PUT split on the SAME path is preserved as two hooks.
 */
export function useIgnoreItem() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { importId: string; itemId: string }) =>
      api.post(
        bankingUrls.bankImportItemIgnore(vars.importId, vars.itemId),
        {}
      ),
    onSuccess: (_data, vars) => invalidateDetail(queryClient, vars.importId),
  });
}

/**
 * Unmatch an Ignored item: **PUT** .../items/{id}/ignore {} (handleUnmatch).
 * DEC-2 = A — same path as `useIgnoreItem`, different method.
 */
export function useUnmatchItem() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { importId: string; itemId: string }) =>
      api.put(bankingUrls.bankImportItemIgnore(vars.importId, vars.itemId), {}),
    onSuccess: (_data, vars) => invalidateDetail(queryClient, vars.importId),
  });
}

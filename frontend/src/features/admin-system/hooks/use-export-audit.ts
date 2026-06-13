"use client";

import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchAuditExport } from "../api/audit-api";
import type { AuditFilterOptions } from "../types/audit.types";

/**
 * CSV export mutation (E27-S4, A79). The god-page exported the CURRENT filter set
 * → Blob → anchor `audit_export_<date>.csv`. The hook returns the Blob; the
 * component owns the anchor/createObjectURL dance (so the URL-mechanism stays
 * exactly where the S1 net pins it). On reject the component surfaces the error
 * (`mutation.error`), mirroring the god-page's export-error branch.
 */
export function useExportAudit() {
  const { accessToken } = useAuth();
  return useMutation<Blob, Error, AuditFilterOptions>({
    mutationFn: (filters) => fetchAuditExport(accessToken ?? "", filters),
  });
}

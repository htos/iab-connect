"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { auditKeys, fetchAuditEvents } from "../api/audit-api";
import type { AuditFilterOptions } from "../types/audit.types";

/**
 * Audit-log server state (E27-S4). The FULL `filters` object is in the query key
 * (server-side filtering across 7 controls + pagination), so TanStack refetches as
 * any filter or the page changes — preserving the god-page's `fetchEvents` on every
 * filter mutation (AC-2). `retry: false` mirrors the god-page, which surfaced the
 * error on the first failed fetch (the wrapped lib fn carries no status). `enabled`
 * mirrors the page's `isAuthenticated && isAdmin && accessToken` gate.
 */
export function useAuditLog(filters: AuditFilterOptions, enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => fetchAuditEvents(accessToken ?? "", filters),
    enabled: enabled && !!accessToken,
    retry: false,
  });
}

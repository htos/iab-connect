"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  auditKeys,
  fetchAuditCategories,
  fetchAuditEventTypes,
} from "../api/audit-api";
import type { AuditCategory, AuditEventType } from "../types/audit.types";

/**
 * The static category + event-type option lists for the audit filter selects.
 * The god-page loaded both in parallel and swallowed any error (`console.error`,
 * no UI), so these degrade to `[]` and never surface an error banner. Two queries
 * keyed independently under the `audit` root.
 */
export function useAuditFilterOptions(enabled: boolean) {
  const { accessToken } = useAuth();

  const categories = useQuery<AuditCategory[]>({
    queryKey: auditKeys.categories(),
    queryFn: () => fetchAuditCategories(accessToken ?? ""),
    enabled: enabled && !!accessToken,
    retry: false,
  });

  const eventTypes = useQuery<AuditEventType[]>({
    queryKey: auditKeys.eventTypes(),
    queryFn: () => fetchAuditEventTypes(accessToken ?? ""),
    enabled: enabled && !!accessToken,
    retry: false,
  });

  return {
    categories: categories.data ?? [],
    eventTypes: eventTypes.data ?? [],
  };
}

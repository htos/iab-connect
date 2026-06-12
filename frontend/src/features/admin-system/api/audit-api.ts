// Audit feature API (E27-S4). DEC-1 = A: this layer WRAPS the existing
// `@/lib/api/audit` transport (token-param fns that own their own `/api/v1/audit`
// URLs + throw on non-ok) rather than re-implementing the URLs against
// `useApiClient`. The slice owns the query-key factory; each wrapper delegates to
// the lib fn byte-identically, so the E27-S1 audit characterization spec that
// `vi.mock("@/lib/api/audit")` keeps intercepting with ZERO transport-mock edits
// (A94). No raw `/api/v1` string lives in any component.
import {
  getAuditEvents,
  exportAuditEvents,
  getAuditCategories,
  getAuditEventTypes,
} from "@/lib/api/audit";
import type {
  AuditCategory,
  AuditEventListResponse,
  AuditEventType,
  AuditFilterOptions,
} from "../types/audit.types";

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). The audit
 * list does SERVER-side filtering across 7 controls + pagination, so the FULL
 * `filters` object is part of the list key — TanStack refetches as ANY filter (or
 * the page) changes, preserving the god-page's `fetchEvents` on every filter
 * mutation (AC-2). `categories`/`eventTypes` are static option lists keyed under
 * the `all` root.
 */
export const auditKeys = {
  all: ["audit"] as const,
  list: (filters: AuditFilterOptions) =>
    ["audit", "list", { ...filters }] as const,
  categories: () => ["audit", "categories"] as const,
  eventTypes: () => ["audit", "event-types"] as const,
};

/** List audit events for the given server-side filter set. */
export function fetchAuditEvents(
  token: string,
  filters: AuditFilterOptions
): Promise<AuditEventListResponse> {
  return getAuditEvents(token, filters);
}

/** Export the current filter set as a CSV Blob (god-page → anchor download). */
export function fetchAuditExport(
  token: string,
  filters: AuditFilterOptions
): Promise<Blob> {
  return exportAuditEvents(token, filters);
}

/** Static category options for the category filter select. */
export function fetchAuditCategories(token: string): Promise<AuditCategory[]> {
  return getAuditCategories(token);
}

/** Static event-type options for the event-type filter select. */
export function fetchAuditEventTypes(token: string): Promise<AuditEventType[]> {
  return getAuditEventTypes(token);
}

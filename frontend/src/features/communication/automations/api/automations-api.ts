// Automations feature API (E25-S2). DEC-1 = A: this layer WRAPS the existing
// `@/lib/api/automations` transport (token-param fns that own their own `/api/v1`
// URLs) rather than re-implementing the URLs against `useApiClient`. The slice
// owns the query-key factory; each wrapper delegates to the lib fn
// byte-identically, so the S1 specs that `vi.mock("@/lib/api/automations")` keep
// intercepting with ZERO transport-mock edits (A94). No raw `/api/v1` string
// lives in any component — the one inline god-page fetch (the member-segment
// dropdown load) is folded into `fetchMemberSegments` here.
import {
  listAutomations,
  getAutomation,
  getExecutions,
  createAutomation,
  updateAutomation,
  changeAutomationStatus,
  previewRecipients,
} from "@/lib/api/automations";
import type {
  AutomationDetailDto,
  AutomationExecutionDto,
  AutomationListItemDto,
  AutomationWriteRequest,
  PagedResponse,
  PreviewRequest,
  RecipientPreviewDto,
} from "../types/automation.types";
import type { MemberSegmentOption } from "../types/automation.types";

// The member-segment dropdown endpoint (DEC-1). The god-page fetched this inline
// in the form's mount effect; the EXACT url is `/api/v1/member-segments?pageSize=100`
// (NOT `/active`) with a Bearer header. Kept here so no component carries a raw
// `/api/v1` string.
const MEMBER_SEGMENTS_BASE = "/api/v1/member-segments";

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
}

/** Server-side filter shape for the automations list (mirrors the god-page args). */
export interface ListAutomationsFilters {
  page: number;
  pageSize: number;
  status?: string;
}

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). The list
 * does SERVER-side `status` filtering + pagination, so `page`/`pageSize`/`status`
 * are part of the list key (TanStack refetches on any change); client-side search
 * stays in the component (not part of the key). `detail`/`executions` are keyed
 * by id.
 */
export const automationsKeys = {
  all: ["automations"] as const,
  list: (filters: ListAutomationsFilters) =>
    ["automations", "list", { ...filters }] as const,
  detail: (id: string) => ["automations", "detail", id] as const,
  executions: (id: string) => ["automations", "executions", id] as const,
};

/**
 * List automations. Delegates to `@/lib/api/automations.listAutomations`,
 * forwarding `page`/`pageSize` always and `status` only when set (the god-page
 * passed `status: status || undefined`).
 */
export function fetchAutomations(
  token: string,
  filters: ListAutomationsFilters
): Promise<PagedResponse<AutomationListItemDto>> {
  return listAutomations(token, {
    page: filters.page,
    pageSize: filters.pageSize,
    status: filters.status || undefined,
  });
}

/** Fetch one automation's detail. */
export function fetchAutomation(
  token: string,
  id: string
): Promise<AutomationDetailDto> {
  return getAutomation(token, id);
}

/** Fetch an automation's recent executions. */
export function fetchExecutions(
  token: string,
  id: string
): Promise<AutomationExecutionDto[]> {
  return getExecutions(token, id);
}

/** Create an automation definition. */
export function postAutomation(
  token: string,
  body: AutomationWriteRequest
): Promise<AutomationDetailDto> {
  return createAutomation(token, body);
}

/** Update an automation definition. */
export function putAutomation(
  token: string,
  id: string,
  body: AutomationWriteRequest
): Promise<AutomationDetailDto> {
  return updateAutomation(token, id, body);
}

/** Run a lifecycle transition (activate/pause/resume/disable). */
export function postAutomationStatus(
  token: string,
  id: string,
  action: "activate" | "pause" | "resume" | "disable"
): Promise<AutomationDetailDto> {
  return changeAutomationStatus(token, id, action);
}

/** Server-computed recipient preview for the form's "Preview recipients" action. */
export function fetchRecipientPreview(
  token: string,
  body: PreviewRequest
): Promise<RecipientPreviewDto> {
  return previewRecipients(token, body);
}

/**
 * Member-segment dropdown options for the form (DEC-1 — the folded inline god-page
 * fetch). Byte-identical to the god-page: GET `/api/v1/member-segments?pageSize=100`
 * with a Bearer header, mapping `{ items }` → `{ id, name }[]` and degrading to
 * `[]` on a non-ok response or thrown fetch (the form swallowed the error).
 */
export async function fetchMemberSegments(
  token: string
): Promise<MemberSegmentOption[]> {
  try {
    const res = await fetch(
      `${baseUrl()}${MEMBER_SEGMENTS_BASE}?pageSize=100`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = res.ok ? await res.json() : { items: [] };
    return (data.items ?? []).map((s: { id: string; name: string }) => ({
      id: s.id,
      name: s.name,
    }));
  } catch {
    return [];
  }
}

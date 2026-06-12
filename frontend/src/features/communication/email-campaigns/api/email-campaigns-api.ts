// Email-campaigns feature API (E25-S3). DEC-1 = A BUILD: there is NO `@/lib`
// client module to wrap for this surface — the four god-pages issued their
// `/api/v1/email-campaigns` requests via INLINE `fetch(... Bearer ...)`. So this
// layer BUILDS the transport on the E21-S1 DEC-1 client contract: the
// `useApiClient()` instance ({ data, error, status }, never throws). URLs /
// params / bodies are BYTE-IDENTICAL to the god-page inline fetches (verified
// against each page). The DTOs/enums + the `getStatusColor`/
// `getRecipientStatusColor`/`getSegmentTypeLabel` helpers stay in
// `@/lib/api/email-campaigns` (reused, not duplicated; surfaced via
// `types/email-campaign.types.ts`).
//
// No raw `/api/v1/...` string lives in any component — they all route through
// these functions (E21-S1 rule 5).
import type { useApiClient } from "@/lib/auth";
import type {
  CreateEmailCampaignRequest,
  EmailCampaignDto,
  EmailCampaignStatistics,
  EmailRecipientDto,
  PagedResponse,
  ScheduleCampaignRequest,
  SendTestEmailRequest,
  UpdateEmailCampaignRequest,
} from "../types/email-campaign.types";

type EmailCampaignsApiClient = ReturnType<typeof useApiClient>;

export const EMAIL_CAMPAIGNS_BASE = "/api/v1/email-campaigns";

// The member-segment dropdown endpoint used by the create/edit form. The
// god-pages fetched this inline (`/api/v1/member-segments/active` with a Bearer
// header); folded here so no component carries a raw `/api/v1` string. NOTE: this
// is the `/active` variant (distinct from the automations slice's
// `?pageSize=100`), kept BYTE-IDENTICAL to the email-campaign god-pages.
const MEMBER_SEGMENTS_ACTIVE = "/api/v1/member-segments/active";

/**
 * Server-side filter shape for the email-campaigns list (mirrors the god-page's
 * inline params): `page`/`pageSize` always present; `status` appended only when
 * set (the god-page did `if (status) params.append("status", status)`). The
 * client-side search box stays in the component (NOT part of the list key).
 */
export interface ListEmailCampaignsFilters {
  page: number;
  pageSize: number;
  status?: string;
}

/**
 * A member segment as surfaced by the form's segment-search dropdown (folded from
 * the god-pages' inline `/member-segments/active` fetch). The god-pages read
 * `id`/`name`/`segmentType` off each item; we keep that shape.
 */
export interface ActiveMemberSegment {
  id: string;
  name: string;
  segmentType: string;
  color?: string;
}

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). The list
 * does SERVER-side `status` filtering + pagination, so `page`/`pageSize`/`status`
 * are part of the list key (TanStack refetches on any change); client-side search
 * stays in the component. `detail`/`statistics`/`recipients` are keyed by id, so
 * a mutation invalidates exactly the affected detail surfaces (A79).
 */
export const emailCampaignsKeys = {
  all: ["email-campaigns"] as const,
  list: (filters: ListEmailCampaignsFilters) =>
    ["email-campaigns", "list", { ...filters }] as const,
  detail: (id: string) => ["email-campaigns", "detail", id] as const,
  statistics: (id: string) => ["email-campaigns", "statistics", id] as const,
  recipients: (id: string) => ["email-campaigns", "recipients", id] as const,
};

// --- List + read ---

/**
 * List campaigns. Byte-identical to the god-page: GET
 * `/api/v1/email-campaigns?page=<page>&pageSize=<pageSize>[&status=<status>]`.
 * `status` is appended only when truthy.
 */
export function fetchEmailCampaigns(
  api: EmailCampaignsApiClient,
  filters: ListEmailCampaignsFilters
) {
  const params = new URLSearchParams();
  params.append("page", filters.page.toString());
  params.append("pageSize", filters.pageSize.toString());
  if (filters.status) params.append("status", filters.status);
  return api.get<PagedResponse<EmailCampaignDto>>(
    `${EMAIL_CAMPAIGNS_BASE}?${params.toString()}`
  );
}

/** Fetch a single campaign by id. */
export function getEmailCampaign(api: EmailCampaignsApiClient, id: string) {
  return api.get<EmailCampaignDto>(`${EMAIL_CAMPAIGNS_BASE}/${id}`);
}

/** Fetch a campaign's aggregate statistics. */
export function getCampaignStatistics(
  api: EmailCampaignsApiClient,
  id: string
) {
  return api.get<EmailCampaignStatistics>(
    `${EMAIL_CAMPAIGNS_BASE}/${id}/statistics`
  );
}

/**
 * Fetch a campaign's recipients. Byte-identical to the god-page:
 * `/api/v1/email-campaigns/{id}/recipients?page=1&pageSize=100`.
 */
export function getCampaignRecipients(
  api: EmailCampaignsApiClient,
  id: string
) {
  return api.get<PagedResponse<EmailRecipientDto>>(
    `${EMAIL_CAMPAIGNS_BASE}/${id}/recipients?page=1&pageSize=100`
  );
}

// --- Create / update / delete ---

export function createEmailCampaign(
  api: EmailCampaignsApiClient,
  body: CreateEmailCampaignRequest
) {
  return api.post<EmailCampaignDto>(EMAIL_CAMPAIGNS_BASE, body);
}

export function updateEmailCampaign(
  api: EmailCampaignsApiClient,
  id: string,
  body: UpdateEmailCampaignRequest
) {
  return api.put<EmailCampaignDto>(`${EMAIL_CAMPAIGNS_BASE}/${id}`, body);
}

export function deleteEmailCampaign(api: EmailCampaignsApiClient, id: string) {
  return api.delete<void>(`${EMAIL_CAMPAIGNS_BASE}/${id}`);
}

// --- The 5 detail status-machine actions (each its own POST) ---

/** POST `/test` with the `{ testEmail }` body (Draft → send a test email). */
export function sendTestEmail(
  api: EmailCampaignsApiClient,
  id: string,
  body: SendTestEmailRequest
) {
  return api.post<void>(`${EMAIL_CAMPAIGNS_BASE}/${id}/test`, body);
}

/** POST `/schedule` with the `{ scheduledAt }` ISO body (Draft → Scheduled). */
export function scheduleCampaign(
  api: EmailCampaignsApiClient,
  id: string,
  body: ScheduleCampaignRequest
) {
  return api.post<void>(`${EMAIL_CAMPAIGNS_BASE}/${id}/schedule`, body);
}

/** POST `/send` (Draft → Send now). No body. */
export function sendCampaign(api: EmailCampaignsApiClient, id: string) {
  return api.post<void>(`${EMAIL_CAMPAIGNS_BASE}/${id}/send`, undefined);
}

/** POST `/cancel` (Scheduled → Cancel). No body. */
export function cancelCampaign(api: EmailCampaignsApiClient, id: string) {
  return api.post<void>(`${EMAIL_CAMPAIGNS_BASE}/${id}/cancel`, undefined);
}

/**
 * POST `/resend` or `/resend-failed` (Sent → Resend). `failedOnly` selects the
 * endpoint exactly as the god-page did. No body.
 */
export function resendCampaign(
  api: EmailCampaignsApiClient,
  id: string,
  failedOnly: boolean
) {
  const endpoint = failedOnly ? "resend-failed" : "resend";
  return api.post<void>(`${EMAIL_CAMPAIGNS_BASE}/${id}/${endpoint}`, undefined);
}

// --- Member-segment dropdown options (folded inline god-page fetch) ---

/**
 * Active member segments for the form's segment-search dropdown (DEC-2 — the
 * folded inline god-page fetch). Byte-identical to the god-pages: GET
 * `/api/v1/member-segments/active` via the api client, returning the raw array
 * and degrading to `[]` on error (the god-pages swallowed the error with
 * `.catch(() => {})`).
 */
export async function fetchActiveMemberSegments(
  api: EmailCampaignsApiClient
): Promise<ActiveMemberSegment[]> {
  const result = await api.get<ActiveMemberSegment[]>(MEMBER_SEGMENTS_ACTIVE);
  if (result.error || !result.data) return [];
  return result.data;
}

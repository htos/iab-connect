/**
 * REQ-028 (E5-S3): Communication automation (journey) API types + client helpers.
 * Mirrors the email-campaigns helper shape. Enum string values byte-match the backend
 * (PascalCase) per project-context "frontend enum values must exactly match backend".
 *
 * E31-S1: relocated verbatim off `automations`; the only change is the
 * shared `RecipientSegmentType` now imports from its `@/types/email-campaigns`
 * home (DEC-2) instead of the retired `email-campaigns`.
 */

import type { PagedResult as PagedResponse } from "@/types/common";
import type { RecipientSegmentType } from "@/types/email-campaigns";

export type { PagedResponse };
export type { RecipientSegmentType };

export type AutomationStatus = "Draft" | "Active" | "Paused" | "Disabled";

export type AutomationTriggerType =
  | "MemberJoined"
  | "EventUpcoming"
  | "MembershipRenewalDue"
  | "Manual"
  | "Scheduled";

export type ConsentType =
  | "DataProcessing"
  | "Newsletter"
  | "Marketing"
  | "EventNotifications"
  | "PhotoUsage";

export type AutomationExecutionStatus = "Running" | "Completed" | "Failed";

export interface AutomationTriggerDto {
  type: AutomationTriggerType;
  offsetDays?: number | null;
}

export interface AutomationListItemDto {
  id: string;
  name: string;
  status: AutomationStatus;
  trigger: AutomationTriggerDto;
  templateId: number;
  templateName?: string | null;
  segmentType: RecipientSegmentType;
  consentFilter?: ConsentType | null;
  createdByName: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface AutomationDetailDto {
  id: string;
  name: string;
  description?: string | null;
  status: AutomationStatus;
  trigger: AutomationTriggerDto;
  templateId: number;
  templateName?: string | null;
  segmentType: RecipientSegmentType;
  segmentFilter?: string | null;
  consentFilter?: ConsentType | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface AutomationExecutionDto {
  id: string;
  status: AutomationExecutionStatus;
  startedAt: string;
  completedAt?: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface RecipientSampleDto {
  memberId?: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface RecipientPreviewDto {
  totalCount: number;
  preview: RecipientSampleDto[];
}

export interface AutomationWriteRequest {
  name: string;
  description?: string | null;
  templateId: number;
  triggerType: AutomationTriggerType;
  offsetDays?: number | null;
  segmentType: RecipientSegmentType;
  segmentFilter?: string | null;
  consentFilter?: ConsentType | null;
}

export interface PreviewRequest {
  segmentType: RecipientSegmentType;
  segmentFilter?: string | null;
  consentFilter?: ConsentType | null;
}

// --- presentation helpers ---

export function getStatusColor(status: AutomationStatus): string {
  switch (status) {
    case "Draft":
      return "bg-gray-100 text-gray-800";
    case "Active":
      return "bg-green-100 text-green-800";
    case "Paused":
      return "bg-yellow-100 text-yellow-800";
    case "Disabled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/** Whether a trigger type carries an offset-in-days parameter. */
export function isTimeRelative(type: AutomationTriggerType): boolean {
  return type === "EventUpcoming" || type === "MembershipRenewalDue";
}

/** Human-readable trigger label, e.g. "7 days before event". `t` resolves the i18n trigger labels. */
export function getTriggerLabel(
  trigger: AutomationTriggerDto,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  switch (trigger.type) {
    case "EventUpcoming":
      return t("triggerLabel.eventUpcoming", { days: trigger.offsetDays ?? 0 });
    case "MembershipRenewalDue":
      return t("triggerLabel.membershipRenewalDue", {
        days: trigger.offsetDays ?? 0,
      });
    case "MemberJoined":
      return t("triggerLabel.memberJoined");
    case "Manual":
      return t("triggerLabel.manual");
    case "Scheduled":
      return t("triggerLabel.scheduled");
    default:
      return trigger.type;
  }
}

// --- fetch client ---

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function listAutomations(
  token: string,
  params: { search?: string; status?: string; page?: number; pageSize?: number }
): Promise<PagedResponse<AutomationListItemDto>> {
  const qs = new URLSearchParams();
  qs.append("page", String(params.page ?? 1));
  qs.append("pageSize", String(params.pageSize ?? 10));
  if (params.search) qs.append("search", params.search);
  if (params.status) qs.append("status", params.status);
  const res = await fetch(`${baseUrl()}/api/v1/automations?${qs.toString()}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("loadError");
  return res.json();
}

export async function getAutomation(
  token: string,
  id: string
): Promise<AutomationDetailDto> {
  const res = await fetch(`${baseUrl()}/api/v1/automations/${id}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("loadError");
  return res.json();
}

export async function createAutomation(
  token: string,
  body: AutomationWriteRequest
): Promise<AutomationDetailDto> {
  const res = await fetch(`${baseUrl()}/api/v1/automations`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res);
  return res.json();
}

export async function updateAutomation(
  token: string,
  id: string,
  body: AutomationWriteRequest
): Promise<AutomationDetailDto> {
  const res = await fetch(`${baseUrl()}/api/v1/automations/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res);
  return res.json();
}

export async function changeAutomationStatus(
  token: string,
  id: string,
  action: "activate" | "pause" | "resume" | "disable"
): Promise<AutomationDetailDto> {
  const res = await fetch(`${baseUrl()}/api/v1/automations/${id}/${action}`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw await toError(res);
  return res.json();
}

export async function previewRecipients(
  token: string,
  body: PreviewRequest
): Promise<RecipientPreviewDto> {
  const res = await fetch(
    `${baseUrl()}/api/v1/automations/recipients/preview`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw await toError(res);
  return res.json();
}

export async function getExecutions(
  token: string,
  id: string
): Promise<AutomationExecutionDto[]> {
  const res = await fetch(`${baseUrl()}/api/v1/automations/${id}/executions`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("loadError");
  return res.json();
}

/** Build an Error whose message is the server's ProblemDetails title/detail when available. */
async function toError(res: Response): Promise<Error> {
  try {
    const body = await res.json();
    if (body?.errors) {
      const fieldErrors = Object.values(body.errors as Record<string, string[]>)
        .flat()
        .join(" ");
      if (fieldErrors) return new Error(fieldErrors);
    }
    return new Error(
      body?.detail || body?.title || body?.message || `HTTP ${res.status}`
    );
  } catch {
    return new Error(`HTTP ${res.status}`);
  }
}

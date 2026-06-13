/**
 * Member duplicate/merge transport (E31-S1; relocated verbatim off the retired
 * `members`). These token-param raw-`fetch` fns + `parseMatchReason`
 * are members-only (the slice's `members-api.ts` owns the `useApiClient` list/
 * detail surface). Behaviour is byte-identical to the legacy module.
 * REQ-018: Duplicate-candidate detection (E2.S2) + groups + dismissals (E2.S4).
 */

import type { PagedResult } from "@/types/common";
import type { MembershipStatus } from "@/types/members";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// REQ-018: Duplicate-candidate types (E2.S2)

export type MatchTier = "Exact" | "Likely";

export type MatchReasonFlag =
  | "None"
  | "Email"
  | "NormalizedPhone"
  | "PostalAndStreet"
  | "EmailLocalPart"
  | "NameOnly";

/**
 * Privacy-respecting candidate surface (mirrors backend DuplicateCandidateDto).
 * MUST NOT carry Phone/Address/KeycloakUserId fields - the backend explicitly omits them.
 */
export interface DuplicateCandidateDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  membershipStatus: MembershipStatus | number | string;
  memberSince: string;
  matchTier: MatchTier;
  /**
   * Flags enum serialized as a comma-joined string by JsonStringEnumConverter,
   * e.g. "NameOnly, EmailLocalPart" or single "Email". `parseMatchReason` splits it.
   */
  matchReason: string;
}

export interface FindMemberDuplicatesParams {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  postalCode?: string;
  excludeMemberId?: string;
}

/**
 * Splits the comma-joined flags-enum representation into individual flag names.
 * Tolerant of leading/trailing whitespace from the .NET serializer ("A, B" or "A,B").
 */
export function parseMatchReason(reason: string): MatchReasonFlag[] {
  if (!reason || reason === "None") return [];
  return reason
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is MatchReasonFlag => s.length > 0) as MatchReasonFlag[];
}

/**
 * REQ-018: Fetch duplicate-candidate members for a given input signal set.
 * Omits empty/undefined query parameters. Returns a typed array of candidates.
 * Throws a sanitized error message on non-2xx responses (no upstream body leakage).
 */
export async function findMemberDuplicates(
  accessToken: string,
  params: FindMemberDuplicatesParams,
  // REQ-018 review patch: optional AbortSignal so callers (debounced re-check) can cancel
  // orphaned in-flight requests when newer input arrives.
  signal?: AbortSignal
): Promise<DuplicateCandidateDto[]> {
  const query = new URLSearchParams();
  if (params.email) query.set("email", params.email);
  if (params.phone) query.set("phone", params.phone);
  if (params.firstName) query.set("firstName", params.firstName);
  if (params.lastName) query.set("lastName", params.lastName);
  if (params.postalCode) query.set("postalCode", params.postalCode);
  if (params.excludeMemberId)
    query.set("excludeMemberId", params.excludeMemberId);

  const url = `${API_BASE}/api/v1/members/duplicates${
    query.toString() ? `?${query.toString()}` : ""
  }`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch duplicate candidates: ${response.status}`);
  }

  return (await response.json()) as DuplicateCandidateDto[];
}

// REQ-018: Cross-table duplicate-groups + dismissal (E2.S4)

/**
 * REQ-018 (E2.S4): a group of duplicate-candidate members returned by
 * `GET /api/v1/members/duplicate-groups`. Mirrors backend DuplicateGroupDto.
 */
export interface DuplicateGroupDto {
  groupKey: string;
  tier: MatchTier;
  members: DuplicateCandidateDto[];
}

export interface GetDuplicateGroupsParams {
  page?: number;
  pageSize?: number;
  minTier?: MatchTier;
}

export interface DismissDuplicateCandidateRequest {
  memberA: string;
  memberB: string;
  reason: string;
}

export interface DismissDuplicateCandidateResult {
  dismissalId: string;
  sourceMemberId: string;
  targetMemberId: string;
  created: boolean;
}

export interface MergeMembersRequest {
  sourceId: string;
  targetId: string;
  reason: string;
  confirmFinanceImpact: boolean;
  confirmKeycloakImpact: boolean;
}

export interface MergeMembersResult {
  targetId: string;
  sourceId: string;
  movedReferences: Record<string, number>;
  auditEventId: string;
}

/**
 * REQ-018 (E2.S4): Fetch a page of duplicate-candidate groups across the entire member table.
 * Vorstand-only endpoint. Throws a sanitized error message on non-2xx responses.
 */
export async function getDuplicateGroups(
  accessToken: string,
  params: GetDuplicateGroupsParams = {}
): Promise<PagedResult<DuplicateGroupDto>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.minTier) query.set("minTier", params.minTier);

  const url = `${API_BASE}/api/v1/members/duplicate-groups${
    query.toString() ? `?${query.toString()}` : ""
  }`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch duplicate groups: ${response.status}`);
  }

  return (await response.json()) as PagedResult<DuplicateGroupDto>;
}

/**
 * REQ-018 (E2.S4): Record a Vorstand-issued "this pair is NOT a duplicate" dismissal.
 * Idempotent — the server returns 200 with the existing row if the pair is already dismissed,
 * 201 Created on a fresh insert. This helper resolves either response shape to a typed result.
 */
export async function dismissDuplicateCandidate(
  accessToken: string,
  request: DismissDuplicateCandidateRequest
): Promise<DismissDuplicateCandidateResult> {
  const response = await fetch(
    `${API_BASE}/api/v1/members/duplicate-dismissals`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to dismiss duplicate candidate: ${response.status}`
    );
  }

  return (await response.json()) as DismissDuplicateCandidateResult;
}

/**
 * REQ-018 (E2.S3 + E2.S4): submit a safe member-merge.
 * Calls the E2.S3 admin-only endpoint; the source member is soft-retired into the target.
 */
export async function mergeMembers(
  accessToken: string,
  request: MergeMembersRequest
): Promise<MergeMembersResult> {
  const {
    sourceId,
    targetId,
    reason,
    confirmFinanceImpact,
    confirmKeycloakImpact,
  } = request;

  const response = await fetch(
    `${API_BASE}/api/v1/members/${sourceId}/merge-into/${targetId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        reason,
        confirmFinanceImpact,
        confirmKeycloakImpact,
      }),
    }
  );

  if (!response.ok) {
    // 409 Conflict from the backend exposes a Reasons[] body. We surface a stable status-coded
    // message so callers can branch on response.status if needed.
    throw new Error(`Failed to merge members: ${response.status}`);
  }

  return (await response.json()) as MergeMembersResult;
}

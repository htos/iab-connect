/**
 * Member API types and client
 * REQ-013: Mitgliederstammdaten
 * REQ-014: Mitgliedschaftsarten & Status
 * REQ-018: Duplicate-candidate detection (E2.S2) + groups + dismissals (E2.S4)
 */

import type { PagedResult } from "@/types/common";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Enums matching backend
export enum MembershipType {
  Regular = "Regular",
  Student = "Student",
  Family = "Family",
  Honorary = "Honorary",
}

export enum MembershipStatus {
  Pending = "Pending",
  Active = "Active",
  Inactive = "Inactive",
  Suspended = "Suspended",
}

// DTOs matching backend
export interface MemberDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  membershipType: MembershipType;
  membershipTypeDisplay: string;
  status: MembershipStatus;
  statusDisplay: string;
  memberSince: string;
}

export type { PagedResult as PagedResponse } from '@/types/common';

export interface MemberStatisticsDto {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  inactiveMembers: number;
  suspendedMembers: number;
  regularMembers: number;
  studentMembers: number;
  familyMembers: number;
  honoraryMembers: number;
}

export interface CreateMemberRequest {
  firstName: string;
  lastName: string;
  email: string;
  street: string;
  city: string;
  postalCode: string;
  country?: string;
  phone?: string;
  membershipType: MembershipType;
}

export interface UpdateMemberRequest {
  firstName: string;
  lastName: string;
  email: string;
  street: string;
  city: string;
  postalCode: string;
  country?: string;
  phone?: string;
}

export interface UpdateOwnProfileRequest {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  postalCode: string;
  country?: string;
  phone?: string;
}

export interface GetMembersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: MembershipStatus;
  type?: MembershipType;
}

// Helper functions

// Maps numeric enum values to translation keys (lowercase)
const statusNumericMap: Record<number, string> = {
  0: "pending",
  1: "active",
  2: "inactive",
  3: "suspended",
};

const typeNumericMap: Record<number, string> = {
  0: "regular",
  1: "student",
  2: "family",
  3: "honorary",
};

/**
 * Converts MembershipStatus to translation key (lowercase)
 * Handles both numeric values (from API) and string enum values
 */
export function getStatusTranslationKey(status: MembershipStatus | number | string): string {
  if (typeof status === "number") {
    return statusNumericMap[status] || "pending";
  }
  if (typeof status === "string") {
    return status.toLowerCase();
  }
  return "pending";
}

/**
 * Converts MembershipType to translation key (lowercase)
 * Handles both numeric values (from API) and string enum values
 */
export function getTypeTranslationKey(type: MembershipType | number | string): string {
  if (typeof type === "number") {
    return typeNumericMap[type] || "regular";
  }
  if (typeof type === "string") {
    return type.toLowerCase();
  }
  return "regular";
}

export function getMembershipTypeLabel(type: MembershipType): string {
  const labels: Record<MembershipType, string> = {
    [MembershipType.Regular]: "Regular Member",
    [MembershipType.Student]: "Student",
    [MembershipType.Family]: "Family Member",
    [MembershipType.Honorary]: "Honorary Member",
  };
  return labels[type] || type;
}

export function getMembershipStatusLabel(status: MembershipStatus): string {
  const labels: Record<MembershipStatus, string> = {
    [MembershipStatus.Pending]: "Pending",
    [MembershipStatus.Active]: "Active",
    [MembershipStatus.Inactive]: "Inactive",
    [MembershipStatus.Suspended]: "Suspended",
  };
  return labels[status] || status;
}

export function getMembershipStatusColor(status: MembershipStatus | number | string): string {
  // Handle numeric values from API
  if (typeof status === "number") {
    const numericColors: Record<number, string> = {
      0: "bg-yellow-100 text-yellow-800",  // Pending
      1: "bg-green-100 text-green-800",    // Active
      2: "bg-gray-100 text-gray-800",      // Inactive
      3: "bg-red-100 text-red-800",        // Suspended
    };
    return numericColors[status] || "bg-gray-100 text-gray-800";
  }
  // Handle string enum values
  const colors: Record<string, string> = {
    [MembershipStatus.Pending]: "bg-yellow-100 text-yellow-800",
    [MembershipStatus.Active]: "bg-green-100 text-green-800",
    [MembershipStatus.Inactive]: "bg-gray-100 text-gray-800",
    [MembershipStatus.Suspended]: "bg-red-100 text-red-800",
    // Also handle lowercase versions
    "pending": "bg-yellow-100 text-yellow-800",
    "active": "bg-green-100 text-green-800",
    "inactive": "bg-gray-100 text-gray-800",
    "suspended": "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

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
  if (params.excludeMemberId) query.set("excludeMemberId", params.excludeMemberId);

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
  const response = await fetch(`${API_BASE}/api/v1/members/duplicate-dismissals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to dismiss duplicate candidate: ${response.status}`);
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
  const { sourceId, targetId, reason, confirmFinanceImpact, confirmKeycloakImpact } = request;

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

export function getMembershipTypeColor(type: MembershipType | number | string): string {
  // Handle numeric values from API
  if (typeof type === "number") {
    const numericColors: Record<number, string> = {
      0: "bg-blue-100 text-blue-800",    // Regular
      1: "bg-purple-100 text-purple-800", // Student
      2: "bg-orange-100 text-orange-800", // Family
      3: "bg-amber-100 text-amber-800",   // Honorary
    };
    return numericColors[type] || "bg-gray-100 text-gray-800";
  }
  // Handle string enum values
  const colors: Record<string, string> = {
    [MembershipType.Regular]: "bg-blue-100 text-blue-800",
    [MembershipType.Student]: "bg-purple-100 text-purple-800",
    [MembershipType.Family]: "bg-orange-100 text-orange-800",
    [MembershipType.Honorary]: "bg-amber-100 text-amber-800",
    // Also handle lowercase versions
    "regular": "bg-blue-100 text-blue-800",
    "student": "bg-purple-100 text-purple-800",
    "family": "bg-orange-100 text-orange-800",
    "honorary": "bg-amber-100 text-amber-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
}

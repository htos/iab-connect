/**
 * Shared member types/enums + presentation helpers (E31-S1, DEC-2). Relocated
 * verbatim off the retired `members`. Lives in `@/types` (a lib-leaf,
 * import-legal from any feature) because these symbols are consumed by BOTH the
 * `members` slice and the `profile` slice; a feature-owned home would force a
 * cross-feature import (E21-S5). The members-only duplicate/merge transport lives
 * in `features/members/api/member-duplicates.ts`.
 *
 * REQ-013: Mitgliederstammdaten · REQ-014: Mitgliedschaftsarten & Status.
 */

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

export type { PagedResult as PagedResponse } from "@/types/common";

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
export function getStatusTranslationKey(
  status: MembershipStatus | number | string
): string {
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
export function getTypeTranslationKey(
  type: MembershipType | number | string
): string {
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

export function getMembershipStatusColor(
  status: MembershipStatus | number | string
): string {
  // Handle numeric values from API
  if (typeof status === "number") {
    const numericColors: Record<number, string> = {
      0: "bg-yellow-100 text-yellow-800", // Pending
      1: "bg-green-100 text-green-800", // Active
      2: "bg-gray-100 text-gray-800", // Inactive
      3: "bg-red-100 text-red-800", // Suspended
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
    pending: "bg-yellow-100 text-yellow-800",
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    suspended: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function getMembershipTypeColor(
  type: MembershipType | number | string
): string {
  // Handle numeric values from API
  if (typeof type === "number") {
    const numericColors: Record<number, string> = {
      0: "bg-blue-100 text-blue-800", // Regular
      1: "bg-purple-100 text-purple-800", // Student
      2: "bg-orange-100 text-orange-800", // Family
      3: "bg-amber-100 text-amber-800", // Honorary
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
    regular: "bg-blue-100 text-blue-800",
    student: "bg-purple-100 text-purple-800",
    family: "bg-orange-100 text-orange-800",
    honorary: "bg-amber-100 text-amber-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
}

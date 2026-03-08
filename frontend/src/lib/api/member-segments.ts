/**
 * Member Segment API types and client
 * REQ-017: Segmentierung & Verteiler
 */

import { MembershipStatus, MembershipType } from "./members";

// Enums matching backend
export enum SegmentType {
  Static = "Static",
  Dynamic = "Dynamic",
}

// DTOs matching backend
export interface MemberSegmentDto {
  id: string;
  name: string;
  description?: string;
  segmentType: SegmentType;
  criteriaJson?: string;
  color?: string;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
}

export interface SegmentMemberDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: MembershipStatus;
  membershipType: MembershipType;
  memberSince: string;
}

export interface SegmentCriteria {
  status?: string[];
  type?: string[];
  memberSince?: {
    from?: string;
    to?: string;
  };
  city?: string;
  country?: string;
}

export interface CreateSegmentRequest {
  name: string;
  segmentType: SegmentType;
  description?: string;
  criteriaJson?: string;
  color?: string;
}

export interface UpdateSegmentRequest {
  name: string;
  description?: string;
  criteriaJson?: string;
  color?: string;
  isActive?: boolean;
}

export interface PreviewResult {
  totalCount: number;
  preview: SegmentMemberDto[];
}

// Segment colors for badges
export const SEGMENT_COLORS = [
  "orange",
  "blue",
  "green",
  "purple",
  "red",
  "yellow",
  "pink",
  "indigo",
] as const;

export function getSegmentColorClasses(color?: string): string {
  const colorMap: Record<string, string> = {
    orange: "bg-orange-100 text-orange-800",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    purple: "bg-purple-100 text-purple-800",
    red: "bg-red-100 text-red-800",
    yellow: "bg-yellow-100 text-yellow-800",
    pink: "bg-pink-100 text-pink-800",
    indigo: "bg-indigo-100 text-indigo-800",
  };
  return colorMap[color ?? "orange"] ?? "bg-gray-100 text-gray-800";
}

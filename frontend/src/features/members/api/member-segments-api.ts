// Member Segments feature API — encapsulates every endpoint URL the four
// segments pages used inline (E21-S1 rule 5: no raw `/api/v1/...` strings in
// components). All fns use the E21-S1 DEC-1 client contract (`useApiClient()`,
// `{ data, error, status }`, never throws). REQ-017: Segmentierung & Verteiler.
//
// The `member-segments` module was types-and-helpers only, so these
// fns are net-new extractions of the pages' inline URLs (S4 Dev Notes). The
// detail typeahead reuses the members `searchMembers` fn (cross-feature, A62) —
// no `/api/v1/members` URL is duplicated here.
import type { useApiClient } from "@/lib/auth";
import type {
  CreateSegmentRequest,
  MemberSegmentDto,
  PreviewResult,
  SegmentMemberDto,
  UpdateSegmentRequest,
} from "../types/member-segment.types";

type SegmentsApiClient = ReturnType<typeof useApiClient>;

export const MEMBER_SEGMENTS_BASE = "/api/v1/member-segments";
const SEGMENT_PAGE_SIZE = 20;

export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). The list
 * key carries search/type/active/page so the TanStack query refetches as any
 * changes — preserving the god-page's filter-driven refetch (replacing the
 * manual `useCallback`/`useEffect` dance). `members(id, page)` is keyed under
 * the detail so a member add/remove invalidates both detail + members.
 */
export const segmentKeys = {
  all: ["member-segments"] as const,
  list: (search: string, type: string, active: string, page: number) =>
    ["member-segments", "list", { search, type, active, page }] as const,
  detail: (id: string) => ["member-segments", "detail", id] as const,
  members: (id: string, page: number) =>
    ["member-segments", "detail", id, "members", page] as const,
};

export interface ListSegmentsArgs {
  page: number;
  search: string;
  type: string;
  active: string;
}

export function fetchSegments(
  api: SegmentsApiClient,
  { page, search, type, active }: ListSegmentsArgs
) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(SEGMENT_PAGE_SIZE));
  if (search) params.set("search", search);
  if (type !== "all") params.set("segmentType", type);
  if (active !== "all") params.set("isActive", active);
  return api.get<PagedResponse<MemberSegmentDto>>(
    `${MEMBER_SEGMENTS_BASE}?${params.toString()}`
  );
}

export function fetchSegment(api: SegmentsApiClient, id: string) {
  return api.get<MemberSegmentDto>(`${MEMBER_SEGMENTS_BASE}/${id}`);
}

export function fetchSegmentMembers(
  api: SegmentsApiClient,
  id: string,
  page: number
) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(SEGMENT_PAGE_SIZE));
  return api.get<PagedResponse<SegmentMemberDto>>(
    `${MEMBER_SEGMENTS_BASE}/${id}/members?${params.toString()}`
  );
}

export function createSegment(
  api: SegmentsApiClient,
  body: CreateSegmentRequest
) {
  return api.post<MemberSegmentDto>(MEMBER_SEGMENTS_BASE, body);
}

export function updateSegment(
  api: SegmentsApiClient,
  id: string,
  body: UpdateSegmentRequest
) {
  return api.put<MemberSegmentDto>(`${MEMBER_SEGMENTS_BASE}/${id}`, body);
}

export function deleteSegment(api: SegmentsApiClient, id: string) {
  return api.delete<void>(`${MEMBER_SEGMENTS_BASE}/${id}`);
}

export function previewSegment(api: SegmentsApiClient, criteriaJson: string) {
  return api.post<PreviewResult>(`${MEMBER_SEGMENTS_BASE}/preview`, {
    criteriaJson,
  });
}

export function addSegmentMember(
  api: SegmentsApiClient,
  id: string,
  memberId: string
) {
  return api.post<void>(`${MEMBER_SEGMENTS_BASE}/${id}/members`, { memberId });
}

export function removeSegmentMember(
  api: SegmentsApiClient,
  id: string,
  memberId: string
) {
  return api.delete<void>(`${MEMBER_SEGMENTS_BASE}/${id}/members/${memberId}`);
}

/** CSV export; `useApiClient` returns the Blob as `data` for a non-JSON body. */
export function exportSegmentCsv(api: SegmentsApiClient, id: string) {
  return api.get<Blob>(`${MEMBER_SEGMENTS_BASE}/${id}/export`);
}

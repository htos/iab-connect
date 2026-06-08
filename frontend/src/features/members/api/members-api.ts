// Members feature API — encapsulates all endpoint URLs (E21-S1 rule 5: no raw
// `/api/v1/...` strings in components). List/detail/delete/status/type/
// statistics/CSV use the E21-S1 DEC-1 client contract (`useApiClient()`,
// `{ data, error, status }`, never throws).
//
// CREATE + UPDATE are the documented S2-DEC-1 exception: they stay on raw
// `fetch` because the backend's 409 ProblemDetails body carries
// `existingMemberId` + `error`, which the shared `useApiClient` contract
// discards (it surfaces only `detail`/text). The REQ-018 duplicate-synthesis
// behaviour pinned by the E23-S1 net (a 409 synthesizes an Exact candidate)
// REQUIRES that raw body. The fetch stays centralized here — no raw URL leaks
// into components (AC-11).
import type { useApiClient } from "@/lib/auth";
import type {
  DismissDuplicateCandidateResult,
  DuplicateGroupDto,
  MergeMembersResult,
} from "@/lib/api/members";
import { MembershipStatus, MembershipType } from "../types/member.types";
import type {
  CreateMemberRequest,
  MemberDto,
  MemberStatisticsDto,
  PagedResponse,
  UpdateMemberRequest,
} from "../types/member.types";

type MembersApiClient = ReturnType<typeof useApiClient>;

const MEMBERS_BASE = "/api/v1/members";
const MEMBERS_CSV_EXPORT = "/api/v1/reports/export/members";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const PAGE_SIZE = "10";

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). Unlike
 * suppliers (client-side search), Members search is SERVER-side, so `search`
 * (and `status`/`type`/`page`) are part of the list key — TanStack refetches as
 * any of them changes, preserving the god-page's per-keystroke server search
 * (S2-DEC-4). `statistics` is keyed under the `all` root so a delete's
 * `invalidateQueries({ queryKey: membersKeys.all })` refetches both list and
 * statistics (matching the god-page's fetchMembers + fetchStatistics).
 */
export const membersKeys = {
  all: ["members"] as const,
  list: (status: string, type: string, search: string, page: number) =>
    ["members", "list", { status, type, search, page }] as const,
  detail: (id: string) => ["members", "detail", id] as const,
  statistics: () => ["members", "statistics"] as const,
};

export interface ListMembersArgs {
  page: number;
  status: string;
  type: string;
  search: string;
}

export function fetchMembers(
  api: MembersApiClient,
  { page, status, type, search }: ListMembersArgs
) {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("pageSize", PAGE_SIZE);
  if (search) params.append("search", search);
  if (status) params.append("status", status);
  if (type) params.append("type", type);
  return api.get<PagedResponse<MemberDto>>(
    `${MEMBERS_BASE}?${params.toString()}`
  );
}

export function fetchMember(api: MembersApiClient, id: string) {
  return api.get<MemberDto>(`${MEMBERS_BASE}/${id}`);
}

export interface MemberSearchResultDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SearchMembersResult {
  items: MemberSearchResultDto[];
  totalCount: number;
}

/**
 * Lightweight member typeahead used cross-feature by the segments detail
 * typeahead (E23-S4). Keeps `search` first in the query string so the segments
 * characterization net's `/api/v1/members?search=…` assertion holds, and reuses
 * the members `/api/v1/members` URL rather than duplicating it in the segments
 * slice (A62).
 */
export function searchMembers(
  api: MembersApiClient,
  query: string,
  page = 1,
  pageSize = 10
) {
  const params = new URLSearchParams();
  params.set("search", query);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return api.get<SearchMembersResult>(`${MEMBERS_BASE}?${params.toString()}`);
}

export function fetchStatistics(api: MembersApiClient) {
  return api.get<MemberStatisticsDto>(`${MEMBERS_BASE}/statistics`);
}

export function deleteMember(api: MembersApiClient, id: string) {
  return api.delete<void>(`${MEMBERS_BASE}/${id}`);
}

export function updateMemberStatus(
  api: MembersApiClient,
  id: string,
  status: MembershipStatus
) {
  return api.put<MemberDto>(`${MEMBERS_BASE}/${id}/status`, { status });
}

export function updateMemberType(
  api: MembersApiClient,
  id: string,
  membershipType: MembershipType
) {
  return api.put<MemberDto>(`${MEMBERS_BASE}/${id}/type`, { membershipType });
}

/** CSV export lives under `/api/v1/reports/...`; `useApiClient` returns the Blob
 * as `data` for a non-JSON response. */
export function exportMembersCsv(api: MembersApiClient) {
  return api.get<Blob>(MEMBERS_CSV_EXPORT);
}

// --- Duplicates (REQ-018 E2.S4): groups / dismissals / merge (E23-S3) ---

const MEMBERS_DUPLICATE_GROUPS = "/api/v1/members/duplicate-groups";
const MEMBERS_DUPLICATE_DISMISSALS = "/api/v1/members/duplicate-dismissals";

/**
 * Duplicate-groups query-key + invalidation convention. `groups` keys page +
 * minTier so the TanStack query refetches as either changes (replacing the
 * god-page's manual refreshKey/queryparam dance). The mutations invalidate
 * `duplicateKeys.all` so a successful merge/dismiss refetches the visible page.
 */
export const duplicateKeys = {
  all: ["members", "duplicates"] as const,
  groups: (page: number, minTier: string) =>
    ["members", "duplicates", "groups", { page, minTier }] as const,
};

export interface FetchDuplicateGroupsArgs {
  page: number;
  pageSize: number;
  minTier: string;
}

export function fetchDuplicateGroups(
  api: MembersApiClient,
  { page, pageSize, minTier }: FetchDuplicateGroupsArgs
) {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("pageSize", String(pageSize));
  if (minTier) params.append("minTier", minTier);
  return api.get<PagedResponse<DuplicateGroupDto>>(
    `${MEMBERS_DUPLICATE_GROUPS}?${params.toString()}`
  );
}

export interface PostDuplicateDismissalArgs {
  memberA: string;
  memberB: string;
  reason: string;
}

export function postDuplicateDismissal(
  api: MembersApiClient,
  { memberA, memberB, reason }: PostDuplicateDismissalArgs
) {
  return api.post<DismissDuplicateCandidateResult>(
    MEMBERS_DUPLICATE_DISMISSALS,
    { memberA, memberB, reason }
  );
}

export interface PostMemberMergeArgs {
  sourceId: string;
  targetId: string;
  reason: string;
  confirmFinanceImpact: boolean;
  confirmKeycloakImpact: boolean;
}

export function postMemberMerge(
  api: MembersApiClient,
  {
    sourceId,
    targetId,
    reason,
    confirmFinanceImpact,
    confirmKeycloakImpact,
  }: PostMemberMergeArgs
) {
  return api.post<MergeMembersResult>(
    `${MEMBERS_BASE}/${sourceId}/merge-into/${targetId}`,
    { reason, confirmFinanceImpact, confirmKeycloakImpact }
  );
}

/**
 * Pure helper: produce the C(N,2) ordered canonical pairs (i<j) for a list of
 * member ids. Drives the cascade-dismiss (one POST per pair) so an N-member
 * group disappears in one action — preserving the god-page's load-bearing
 * Promise.all behaviour (3 members → 3 pairs).
 */
export function buildCanonicalPairs(
  ids: string[]
): Array<{ memberA: string; memberB: string }> {
  const pairs: Array<{ memberA: string; memberB: string }> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push({ memberA: ids[i], memberB: ids[j] });
    }
  }
  return pairs;
}

// --- Create/update (raw-fetch exception, see file header) ---

/**
 * 409 with an `existingMemberId` body — the duplicate the backend refuses to
 * shadow. Carries the id so the form can synthesize an Exact candidate, and the
 * server's `error` text (null → caller falls back to the translated key),
 * preserving the god-page's `new Error(errorData.error || t(...blocked))`.
 */
export class MemberConflictError extends Error {
  constructor(
    public readonly existingMemberId: string,
    public readonly serverMessage: string | null
  ) {
    super("members.duplicateWarning.blocked");
    this.name = "MemberConflictError";
  }
}

/** Non-409 save failure. `serverMessage` is the body `message` (null → caller
 * falls back to the translated `error.savingError`). */
export class MemberSaveError extends Error {
  constructor(public readonly serverMessage: string | null) {
    super("error.savingError");
    this.name = "MemberSaveError";
  }
}

function jsonAuthHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export async function createMember(
  accessToken: string,
  body: CreateMemberRequest
): Promise<MemberDto> {
  const response = await fetch(`${API_BASE}${MEMBERS_BASE}`, {
    method: "POST",
    headers: jsonAuthHeaders(accessToken),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    if (response.status === 409 && errorData?.existingMemberId) {
      throw new MemberConflictError(
        errorData.existingMemberId,
        errorData.error ?? null
      );
    }
    throw new MemberSaveError(errorData?.message ?? null);
  }
  return (await response.json()) as MemberDto;
}

export async function updateMember(
  accessToken: string,
  id: string,
  body: UpdateMemberRequest
): Promise<MemberDto> {
  const response = await fetch(`${API_BASE}${MEMBERS_BASE}/${id}`, {
    method: "PUT",
    headers: jsonAuthHeaders(accessToken),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    if (response.status === 409 && errorData?.existingMemberId) {
      throw new MemberConflictError(
        errorData.existingMemberId,
        errorData.error ?? null
      );
    }
    throw new MemberSaveError(errorData?.message ?? null);
  }
  return (await response.json()) as MemberDto;
}

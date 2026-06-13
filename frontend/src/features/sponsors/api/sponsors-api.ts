// Sponsors feature API — encapsulates all endpoint URLs (E21-S1 rule 5: no raw
// `/api/v1/...` strings in components). Uses the E21-S1 DEC-1 client contract:
// the `useApiClient()` hook instance ({ data, error, status }, never throws).
import type { useApiClient } from "@/lib/auth";
import type {
  AddLinkRequest,
  AddPackageRequest,
  CreateSponsorRequest,
  SponsorDetailDto,
  SponsorListDto,
  SponsorStatus,
  UpdateSponsorRequest,
} from "../types/sponsor.types";

type SponsorsApiClient = ReturnType<typeof useApiClient>;

const SPONSORS_BASE = "/api/v1/sponsors";

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy).
 * `list` is keyed by the server-side `status` filter only; client-side search
 * is NOT part of the key (it filters already-fetched data).
 */
export const sponsorsKeys = {
  all: ["sponsors"] as const,
  list: (status: string) => ["sponsors", "list", { status }] as const,
  detail: (id: string) => ["sponsors", "detail", id] as const,
};

export function fetchSponsors(api: SponsorsApiClient, status: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return api.get<SponsorListDto[]>(`${SPONSORS_BASE}${query}`);
}

export function deleteSponsor(api: SponsorsApiClient, id: string) {
  return api.delete<void>(`${SPONSORS_BASE}/${id}`);
}

// --- Detail + form endpoints (E22-S3) — same URLs/payloads as the god-pages,
// relocated here so route files carry no raw `/api/v1/...` strings. ---

export function getSponsor(api: SponsorsApiClient, id: string) {
  return api.get<SponsorDetailDto>(`${SPONSORS_BASE}/${id}`);
}

export function createSponsor(
  api: SponsorsApiClient,
  body: CreateSponsorRequest
) {
  return api.post<SponsorDetailDto>(SPONSORS_BASE, body);
}

export function updateSponsor(
  api: SponsorsApiClient,
  id: string,
  body: UpdateSponsorRequest
) {
  return api.put<SponsorDetailDto>(`${SPONSORS_BASE}/${id}`, body);
}

export function updateSponsorStatus(
  api: SponsorsApiClient,
  id: string,
  status: SponsorStatus
) {
  return api.put<SponsorDetailDto>(`${SPONSORS_BASE}/${id}/status`, { status });
}

export function addPackage(
  api: SponsorsApiClient,
  id: string,
  body: AddPackageRequest
) {
  return api.post<SponsorDetailDto>(`${SPONSORS_BASE}/${id}/packages`, body);
}

export function removePackage(
  api: SponsorsApiClient,
  id: string,
  packageId: string
) {
  return api.delete<SponsorDetailDto>(
    `${SPONSORS_BASE}/${id}/packages/${packageId}`
  );
}

export function addLink(
  api: SponsorsApiClient,
  id: string,
  body: AddLinkRequest
) {
  return api.post<SponsorDetailDto>(`${SPONSORS_BASE}/${id}/links`, body);
}

export function removeLink(api: SponsorsApiClient, id: string, linkId: string) {
  return api.delete<SponsorDetailDto>(`${SPONSORS_BASE}/${id}/links/${linkId}`);
}

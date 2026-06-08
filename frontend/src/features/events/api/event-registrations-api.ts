// Event-registrations sub-domain API (E24-S3). Owns every registration URL the
// registrations god-page (and, later, the detail page's registration section)
// hit — no raw `/api/v1/...` strings in components. Built on the same
// `EVENTS_BASE` + `eventsKeys` as the events slice (relative import), using the
// E21-S1 DEC-1 client contract: a `useApiClient()` instance whose verb methods
// resolve to `{ data, error, status }` and never throw. URLs/params/bodies are
// BYTE-IDENTICAL to `@/lib/services/events` (which prefixes `/api/v1`): e.g.
// `getEventRegistrations` -> GET `/api/v1/events/{id}/registrations?...`, the
// status actions POST an empty body to `.../{regId}/{action}`, etc.
import type { useApiClient } from "@/lib/auth";
import { EVENTS_BASE } from "./events-api";
import type {
  EventRegistrationDto,
  EventRegistrationStatistics,
  PagedRegistrationResult,
  RegisterMemberRequest,
  RegistrationStatus,
  UpdateRegistrationRequest,
} from "../types/events.types";

type EventsApiClient = ReturnType<typeof useApiClient>;

/**
 * List/filter params for the manager registrations list. Mirrors the
 * `getEventRegistrations` service signature 1:1 so the query string is built in
 * the same order: `status`, `isWaitlisted`, `searchTerm`, `page`, `pageSize` —
 * each appended ONLY when set (matching the god-page, which sends pageSize=20).
 */
export interface RegistrationListParams {
  status?: RegistrationStatus;
  isWaitlisted?: boolean;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
}

// === Manager surface (used by the registrations god-page) ===

/**
 * GET `/api/v1/events/{id}/registrations?...`. Byte-identical to the service:
 * params appended in the order status → isWaitlisted → searchTerm → page →
 * pageSize, omitting any that are unset; `?` is added only when ≥1 param.
 */
export function getEventRegistrations(
  api: EventsApiClient,
  eventId: string,
  params?: RegistrationListParams
) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.isWaitlisted !== undefined)
    searchParams.set("isWaitlisted", String(params.isWaitlisted));
  if (params?.searchTerm) searchParams.set("searchTerm", params.searchTerm);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
  const query = searchParams.toString();
  return api.get<PagedRegistrationResult>(
    `${EVENTS_BASE}/${eventId}/registrations${query ? `?${query}` : ""}`
  );
}

export function getEventRegistrationStatistics(
  api: EventsApiClient,
  eventId: string
) {
  return api.get<EventRegistrationStatistics>(
    `${EVENTS_BASE}/${eventId}/registrations/statistics`
  );
}

/** POST `.../registrations/{regId}/cancel` with `{ reason }` (god-page parity). */
export function cancelEventRegistration(
  api: EventsApiClient,
  eventId: string,
  registrationId: string,
  reason?: string
) {
  return api.post<EventRegistrationDto>(
    `${EVENTS_BASE}/${eventId}/registrations/${registrationId}/cancel`,
    { reason }
  );
}

export function confirmEventRegistration(
  api: EventsApiClient,
  eventId: string,
  registrationId: string
) {
  return api.post<EventRegistrationDto>(
    `${EVENTS_BASE}/${eventId}/registrations/${registrationId}/confirm`,
    {}
  );
}

export function checkInRegistration(
  api: EventsApiClient,
  eventId: string,
  registrationId: string
) {
  return api.post<EventRegistrationDto>(
    `${EVENTS_BASE}/${eventId}/registrations/${registrationId}/check-in`,
    {}
  );
}

export function markRegistrationAsNoShow(
  api: EventsApiClient,
  eventId: string,
  registrationId: string
) {
  return api.post<EventRegistrationDto>(
    `${EVENTS_BASE}/${eventId}/registrations/${registrationId}/no-show`,
    {}
  );
}

export function revertRegistrationNoShow(
  api: EventsApiClient,
  eventId: string,
  registrationId: string
) {
  return api.post<EventRegistrationDto>(
    `${EVENTS_BASE}/${eventId}/registrations/${registrationId}/revert-no-show`,
    {}
  );
}

export function revertRegistrationCheckIn(
  api: EventsApiClient,
  eventId: string,
  registrationId: string
) {
  return api.post<EventRegistrationDto>(
    `${EVENTS_BASE}/${eventId}/registrations/${registrationId}/revert-check-in`,
    {}
  );
}

export function revertRegistrationCancellation(
  api: EventsApiClient,
  eventId: string,
  registrationId: string
) {
  return api.post<EventRegistrationDto>(
    `${EVENTS_BASE}/${eventId}/registrations/${registrationId}/revert-cancellation`,
    {}
  );
}

/** POST `.../registrations/promote-from-waitlist` with an empty body. */
export function promoteFromWaitlist(api: EventsApiClient, eventId: string) {
  return api.post<EventRegistrationDto>(
    `${EVENTS_BASE}/${eventId}/registrations/promote-from-waitlist`,
    {}
  );
}

// === Member-facing surface (folded for the detail-page seam) ===

/**
 * POST `.../registrations` with the member request body. The detail page passes
 * `{ numberOfGuests, specialRequirements }`; the body defaults to `{}` to match
 * the service signature.
 */
export function registerForEvent(
  api: EventsApiClient,
  eventId: string,
  request: RegisterMemberRequest = {}
) {
  return api.post<EventRegistrationDto>(
    `${EVENTS_BASE}/${eventId}/registrations`,
    request
  );
}

/** GET `/api/v1/my-registrations` (note: NOT under the event path). */
export function getMyRegistrations(api: EventsApiClient) {
  return api.get<EventRegistrationDto[]>("/api/v1/my-registrations");
}

export function getEventWaitlist(api: EventsApiClient, eventId: string) {
  return api.get<EventRegistrationDto[]>(
    `${EVENTS_BASE}/${eventId}/registrations/waitlist`
  );
}

export function getEventRegistration(
  api: EventsApiClient,
  eventId: string,
  registrationId: string
) {
  return api.get<EventRegistrationDto>(
    `${EVENTS_BASE}/${eventId}/registrations/${registrationId}`
  );
}

export function updateEventRegistration(
  api: EventsApiClient,
  eventId: string,
  registrationId: string,
  request: UpdateRegistrationRequest
) {
  return api.put<EventRegistrationDto>(
    `${EVENTS_BASE}/${eventId}/registrations/${registrationId}`,
    request
  );
}

// === Export URL builders (already on `useApiClient` in the god-page) ===
// Relocated here so no raw `/api/v1/...` literal lives in the component. The PDF
// export sits under the events path; the CSV export under the reports path.

export function registrationsExportPdfUrl(eventId: string) {
  return `${EVENTS_BASE}/${eventId}/registrations/export-pdf`;
}

export function registrationsExportCsvUrl(eventId: string) {
  return `/api/v1/reports/export/events/${eventId}/registrations`;
}

// Events feature API — encapsulates all endpoint URLs (E21-S1 rule 5: no raw
// `/api/v1/...` strings in components). Covers ONLY event CRUD + statistics
// (DEC-1); registration/waitlist/roster/fee/volunteer functions stay in
// `events` (S3 owns them, DEC-2). Uses the E21-S1 DEC-1 client
// contract: the `useApiClient()` hook instance ({ data, error, status }, never
// throws). URLs are byte-identical to the god-pages they replace.
import type { useApiClient } from "@/lib/auth";
import type {
  CreateEventRequest,
  EventDto,
  EventStatistics,
  PagedResponse,
  UpdateEventRequest,
} from "../types/events.types";

type EventsApiClient = ReturnType<typeof useApiClient>;

// Exported so the E24-S3 sub-domain api modules (registrations/check-in/fees/
// volunteers) build their URLs from the same base without re-declaring it.
export const EVENTS_BASE = "/api/v1/events";

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). The list
 * god-page does SERVER-side search/status/category filtering (per-keystroke,
 * debounced), so `search`/`status`/`category`/`page` are all part of the list
 * key — TanStack refetches as any of them changes. `statistics` is keyed under
 * the `all` root so a CRUD mutation's `invalidateQueries({ queryKey:
 * eventsKeys.all })` refetches both the list and the statistics cards.
 */
export const eventsKeys = {
  all: ["events"] as const,
  list: (filters: ListEventsFilters) =>
    ["events", "list", { ...filters }] as const,
  statistics: () => ["events", "statistics"] as const,
  detail: (id: string) => ["events", "detail", id] as const,
  // --- E24-S3 sub-page key branches (nested under detail(id) so a detail
  // invalidation cascades; each sub-domain refetches on its own mutations) ---
  roster: (id: string) => ["events", "detail", id, "roster"] as const,
  registrations: (id: string, filters?: unknown) =>
    filters === undefined
      ? (["events", "detail", id, "registrations"] as const)
      : (["events", "detail", id, "registrations", { ...(filters as object) }] as const),
  registrationStatistics: (id: string) =>
    ["events", "detail", id, "registration-statistics"] as const,
  waitlist: (id: string) => ["events", "detail", id, "waitlist"] as const,
  myRegistrations: () => ["events", "my-registrations"] as const,
  fees: (id: string) => ["events", "detail", id, "fees"] as const,
  volunteerRoles: (id: string) =>
    ["events", "detail", id, "volunteer-roles"] as const,
  volunteerShifts: (id: string) =>
    ["events", "detail", id, "volunteer-shifts"] as const,
};

export interface ListEventsFilters {
  page: number;
  search: string;
  status: string;
  category: string;
}

/**
 * List events. Reproduces the god-page query string byte-identically: `page` +
 * `pageSize=12` are always sent (in that order); `search`/`status`/`category`
 * are appended ONLY when non-empty, in that order.
 */
export function fetchEvents(
  api: EventsApiClient,
  { page, search, status, category }: ListEventsFilters
) {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("pageSize", "12");
  if (search) params.append("search", search);
  if (status) params.append("status", status);
  if (category) params.append("category", category);
  return api.get<PagedResponse<EventDto>>(
    `${EVENTS_BASE}?${params.toString()}`
  );
}

export function fetchEventStatistics(api: EventsApiClient) {
  return api.get<EventStatistics>(`${EVENTS_BASE}/statistics`);
}

export function getEvent(api: EventsApiClient, id: string) {
  return api.get<EventDto>(`${EVENTS_BASE}/${id}`);
}

export function createEvent(api: EventsApiClient, body: CreateEventRequest) {
  return api.post<EventDto>(EVENTS_BASE, body);
}

export function updateEvent(
  api: EventsApiClient,
  id: string,
  body: UpdateEventRequest
) {
  return api.put<EventDto>(`${EVENTS_BASE}/${id}`, body);
}

/** Publish a Draft event. The god-page POSTs an empty body. */
export function publishEvent(api: EventsApiClient, id: string) {
  return api.post<EventDto>(`${EVENTS_BASE}/${id}/publish`, {});
}

/** Unpublish a Published event. The god-page POSTs an empty body. */
export function unpublishEvent(api: EventsApiClient, id: string) {
  return api.post<EventDto>(`${EVENTS_BASE}/${id}/unpublish`, {});
}

/**
 * Cancel an event. The god-page POSTs `{ reason: cancelReason || undefined }`,
 * so `reason` is optional and omitted (sent as `undefined`) when blank —
 * byte-identical to today.
 */
export function cancelEvent(api: EventsApiClient, id: string, reason?: string) {
  return api.post<EventDto>(`${EVENTS_BASE}/${id}/cancel`, { reason });
}

export function deleteEvent(api: EventsApiClient, id: string) {
  return api.delete<void>(`${EVENTS_BASE}/${id}`);
}

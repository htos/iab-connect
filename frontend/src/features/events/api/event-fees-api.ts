// Event fee-category sub-domain API (E24-S3). Encapsulates the four fee-category
// endpoint URLs (E21-S1 rule 5: no raw `/api/v1/...` strings in components),
// building them off the shared `EVENTS_BASE` so they stay byte-identical to the
// `events` functions they replace. Uses the E21-S1 DEC-1 client
// contract: the `useApiClient()` hook instance ({ data, error, status }, never
// throws).
//
// URL parity note: the legacy service called `apiGet('/events/{id}/fee-categories/')`
// where the shared `apiGet` prepends `/api/v1`; here we prepend it via
// `EVENTS_BASE`, so the wire URL is unchanged. The trailing slash on the
// collection routes is preserved verbatim; `deactivate` is POST (not DELETE),
// matching the backend soft-retire endpoint.
import type { useApiClient } from "@/lib/auth";
import { EVENTS_BASE } from "./events-api";
import type {
  EventFeeCategoryDto,
  SaveFeeCategoryRequest,
} from "../types/events.types";

type EventsApiClient = ReturnType<typeof useApiClient>;

/** GET /api/v1/events/{eventId}/fee-categories/ (god-page sends no query). */
export function getEventFeeCategories(api: EventsApiClient, eventId: string) {
  return api.get<EventFeeCategoryDto[]>(
    `${EVENTS_BASE}/${eventId}/fee-categories/`
  );
}

/** POST /api/v1/events/{eventId}/fee-categories/ with the save body. */
export function createEventFeeCategory(
  api: EventsApiClient,
  eventId: string,
  body: SaveFeeCategoryRequest
) {
  return api.post<EventFeeCategoryDto>(
    `${EVENTS_BASE}/${eventId}/fee-categories/`,
    body
  );
}

/** PUT /api/v1/events/{eventId}/fee-categories/{categoryId} with the save body. */
export function updateEventFeeCategory(
  api: EventsApiClient,
  eventId: string,
  categoryId: string,
  body: SaveFeeCategoryRequest
) {
  return api.put<EventFeeCategoryDto>(
    `${EVENTS_BASE}/${eventId}/fee-categories/${categoryId}`,
    body
  );
}

/**
 * POST /api/v1/events/{eventId}/fee-categories/{categoryId}/deactivate with an
 * empty body — soft-retire (never hard-delete), byte-identical to the god-page.
 */
export function deactivateEventFeeCategory(
  api: EventsApiClient,
  eventId: string,
  categoryId: string
) {
  return api.post<EventFeeCategoryDto>(
    `${EVENTS_BASE}/${eventId}/fee-categories/${categoryId}/deactivate`,
    {}
  );
}

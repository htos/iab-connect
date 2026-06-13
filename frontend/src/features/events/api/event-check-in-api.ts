// Events check-in sub-domain API (E24-S3). Encapsulates the three check-in
// endpoint URLs the check-in god-page called inline through
// `events` (E21-S1 rule 5: no raw `/api/v1/...` in components).
// All fns use the E21-S1 DEC-1 client contract (`useApiClient()`,
// `{ data, error, status }`, never throws). URLs are BYTE-IDENTICAL to the
// service fns they fold (`getEventCheckInRoster`, `checkInByQrCode`,
// `manualCheckIn`) — confirmed against `events`:
//   - service `apiGet/apiPost` prepend `/api/v1`; the slice client prepends
//     nothing, so `EVENTS_BASE` already carries `/api/v1/events` and the QR
//     route is the absolute `/api/v1/registrations/...` (NOT under /events).
import type { useApiClient } from "@/lib/auth";
import type {
  CheckInResultDto,
  EventCheckInRosterDto,
} from "../types/events.types";
import { EVENTS_BASE } from "./events-api";

type EventsApiClient = ReturnType<typeof useApiClient>;

/**
 * Roster for the manual-search fallback list. Mirrors
 * `getEventCheckInRoster(eventId, { includeWaitlisted: false })`: the god-page
 * always passed `includeWaitlisted: false`, which the service translated to NO
 * query string (the flag is only appended when truthy). So this fn emits the
 * bare roster URL — byte-identical to today.
 */
export function getCheckInRoster(api: EventsApiClient, eventId: string) {
  return api.get<EventCheckInRosterDto>(
    `${EVENTS_BASE}/${eventId}/registrations/check-in-roster`
  );
}

/**
 * QR-token check-in. The token is `encodeURIComponent`-encoded EXACTLY as the
 * service did (post-review H-S2-3: tokens may contain `/ ? #` or spaces). The
 * route is the absolute `/api/v1/registrations/check-in/{token}` (NOT nested
 * under the event), matching the service URL `/registrations/check-in/{token}`.
 * POSTs an empty body, as today.
 */
export function checkInByQrCode(
  api: EventsApiClient,
  _eventId: string,
  token: string
) {
  return api.post<CheckInResultDto>(
    `/api/v1/registrations/check-in/${encodeURIComponent(token)}`,
    {}
  );
}

/**
 * Manual-search check-in. URL byte-identical to
 * `manualCheckIn(eventId, registrationId, searchQuery)`. The optional audit
 * `searchQuery` is forwarded in the body as `searchQuery: searchQuery ?? null`,
 * preserving the service body shape exactly.
 */
export function manualCheckIn(
  api: EventsApiClient,
  eventId: string,
  registrationId: string,
  searchQuery?: string
) {
  return api.post<CheckInResultDto>(
    `${EVENTS_BASE}/${eventId}/registrations/${registrationId}/manual-check-in`,
    { searchQuery: searchQuery ?? null }
  );
}

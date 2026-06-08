// Events feature — VOLUNTEER sub-domain API (E24-S3). Encapsulates every
// volunteer endpoint URL so components/hooks never hold a raw `/api/v1/...`
// string (E21-S1 rule 5). Folds the volunteer functions previously in
// `@/lib/services/events` (`getEventVolunteerRoles`, `createVolunteerRole`,
// `updateVolunteerRole`, `getEventVolunteerShifts`, `createVolunteerShift`,
// `updateVolunteerShift`, `cancelVolunteerShift`, `getVolunteerShiftAssignments`)
// PLUS the member-facing self-signup set (`signUpForVolunteerShift`,
// `withdrawFromVolunteerShift`, `getMyWaitlistPosition`) the
// `VolunteerSelfSignupSection` consumes (the orchestrator repoints it later).
//
// URLs are BYTE-IDENTICAL to the legacy service: the legacy `apiGet/apiPost`
// helpers prepend `/api/v1`, so the legacy `/events/{id}/volunteer-roles/`
// becomes `${EVENTS_BASE}/{id}/volunteer-roles/` here (note: trailing slash on
// the collection endpoints, POST `/cancel` for shift cancellation, POST
// `/self-signup`, and the assignment-scoped `/cancel` for withdraw — all
// preserved exactly). Uses the E21-S1 DEC-1 client contract: the
// `useApiClient()` instance ({ data, error, status }, never throws).
import type { useApiClient } from "@/lib/auth";
import { EVENTS_BASE } from "./events-api";
import type {
  CreateVolunteerShiftRequest,
  EventVolunteerAssignmentDto,
  EventVolunteerRoleDto,
  EventVolunteerShiftDto,
} from "../types/events.types";

type EventsApiClient = ReturnType<typeof useApiClient>;

// Result of cancelling a shift (legacy returned `{ cancelledAssignmentCount }`).
export interface CancelVolunteerShiftResult {
  cancelledAssignmentCount: number;
}

// Member-facing waitlist position (legacy `WaitlistPositionDto`, REQ-021).
export interface WaitlistPositionDto {
  registrationId: string;
  eventId: string;
  position: number;
  totalOnWaitlist: number;
  registeredAt: string;
}

// --- Roles ---

export function getEventVolunteerRoles(api: EventsApiClient, eventId: string) {
  return api.get<EventVolunteerRoleDto[]>(
    `${EVENTS_BASE}/${eventId}/volunteer-roles/`
  );
}

export function createVolunteerRole(
  api: EventsApiClient,
  eventId: string,
  request: { name: string; description?: string | null }
) {
  return api.post<EventVolunteerRoleDto>(
    `${EVENTS_BASE}/${eventId}/volunteer-roles/`,
    request
  );
}

export function updateVolunteerRole(
  api: EventsApiClient,
  eventId: string,
  roleId: string,
  request: { name: string; description?: string | null; isActive: boolean }
) {
  return api.put<EventVolunteerRoleDto>(
    `${EVENTS_BASE}/${eventId}/volunteer-roles/${roleId}`,
    request
  );
}

// --- Shifts ---

export function getEventVolunteerShifts(api: EventsApiClient, eventId: string) {
  return api.get<EventVolunteerShiftDto[]>(
    `${EVENTS_BASE}/${eventId}/volunteer-shifts/`
  );
}

export function createVolunteerShift(
  api: EventsApiClient,
  eventId: string,
  request: CreateVolunteerShiftRequest
) {
  return api.post<EventVolunteerShiftDto>(
    `${EVENTS_BASE}/${eventId}/volunteer-shifts/`,
    request
  );
}

export function updateVolunteerShift(
  api: EventsApiClient,
  eventId: string,
  shiftId: string,
  request: Omit<CreateVolunteerShiftRequest, "roleId">
) {
  return api.put<EventVolunteerShiftDto>(
    `${EVENTS_BASE}/${eventId}/volunteer-shifts/${shiftId}`,
    request
  );
}

/**
 * Cancel a shift. The legacy service POSTed `{ reason: reason ?? null }` to the
 * `/cancel` sub-resource (NOT an HTTP DELETE) — preserved byte-identically.
 */
export function cancelVolunteerShift(
  api: EventsApiClient,
  eventId: string,
  shiftId: string,
  reason?: string
) {
  return api.post<CancelVolunteerShiftResult>(
    `${EVENTS_BASE}/${eventId}/volunteer-shifts/${shiftId}/cancel`,
    { reason: reason ?? null }
  );
}

// --- Assignments ---

export function getVolunteerShiftAssignments(
  api: EventsApiClient,
  eventId: string,
  shiftId: string
) {
  return api.get<EventVolunteerAssignmentDto[]>(
    `${EVENTS_BASE}/${eventId}/volunteer-shifts/${shiftId}/assignments`
  );
}

// --- Member-facing self-signup (consumed by VolunteerSelfSignupSection) ---

/**
 * Self-signup for a shift. Legacy POSTed `{ allowWaitlistFallback }` to the
 * `/self-signup` sub-resource (default false) — preserved byte-identically.
 */
export function signUpForVolunteerShift(
  api: EventsApiClient,
  eventId: string,
  shiftId: string,
  allowWaitlistFallback = false
) {
  return api.post<EventVolunteerAssignmentDto>(
    `${EVENTS_BASE}/${eventId}/volunteer-shifts/${shiftId}/self-signup`,
    { allowWaitlistFallback }
  );
}

/**
 * Withdraw the current member from a shift. Legacy POSTed `{ reason }` to the
 * assignment-scoped `/cancel` sub-resource (the withdraw endpoint requires the
 * assignment id, not the shift id) — preserved byte-identically.
 */
export function withdrawFromVolunteerShift(
  api: EventsApiClient,
  eventId: string,
  shiftId: string,
  assignmentId: string,
  reason?: string
) {
  return api.post<EventVolunteerAssignmentDto>(
    `${EVENTS_BASE}/${eventId}/volunteer-shifts/${shiftId}/assignments/${assignmentId}/cancel`,
    { reason: reason ?? null }
  );
}

/**
 * Current member's waitlist position for an event (REQ-021). Legacy hit
 * `/events/{id}/registrations/my-position` — preserved byte-identically.
 */
export function getMyWaitlistPosition(api: EventsApiClient, eventId: string) {
  return api.get<WaitlistPositionDto>(
    `${EVENTS_BASE}/${eventId}/registrations/my-position`
  );
}

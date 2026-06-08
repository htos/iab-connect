/**
 * REQ-019: Event Management Service
 * Provides API functions for event management.
 */

// A62: after the dead-export cleanup only GET/POST helpers remain in use here (apiPut/apiDelete
// were dropped with the removed manager fns). PagedResult is re-exported below straight from
// `@/types/common`, so no value import is needed.
import { apiGet, apiPost, type ApiResult } from './api';

// Types matching backend DTOs
export interface EventDto {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  location: string;
  locationAddress?: string;
  locationUrl?: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  timeZone: string;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  maxParticipants?: number;
  registrationRequired: boolean;
  registrationDeadline?: string;
  waitlistEnabled: boolean;
  visibility: EventVisibility;
  status: EventStatus;
  category: EventCategory;
  tags: string[];
  imageUrl?: string;
  imageAltText?: string;
  organizerId?: string;
  organizerName?: string;
  contactEmail?: string;
  contactPhone?: string;
  cost?: number;
  costDescription?: string;
  isFree: boolean;
  contentLanguage?: string; // REQ-055 (E7-S4): ISO 639-1 content language; undefined = default
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  hasStarted: boolean;
  hasEnded: boolean;
  isRegistrationOpen: boolean;
}

export enum EventVisibility {
  MembersOnly = 'MembersOnly',
  Public = 'Public',
  InviteOnly = 'InviteOnly',
  Hidden = 'Hidden',
}

export enum EventStatus {
  Draft = 'Draft',
  Published = 'Published',
  Cancelled = 'Cancelled',
  Completed = 'Completed',
}

export enum EventCategory {
  General = 'General',
  Cultural = 'Cultural',
  Social = 'Social',
  Educational = 'Educational',
  Sports = 'Sports',
  Religious = 'Religious',
  Charity = 'Charity',
  Meeting = 'Meeting',
  Workshop = 'Workshop',
  Festival = 'Festival',
  Other = 'Other',
}

export enum RecurrencePattern {
  Daily = 'Daily',
  Weekly = 'Weekly',
  BiWeekly = 'BiWeekly',
  Monthly = 'Monthly',
  Yearly = 'Yearly',
}

export interface CreateEventRequest {
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  shortDescription?: string;
  locationAddress?: string;
  locationUrl?: string;
  isAllDay?: boolean;
  timeZone?: string;
  maxParticipants?: number;
  registrationRequired?: boolean;
  registrationDeadline?: string;
  waitlistEnabled?: boolean;
  visibility?: EventVisibility;
  category?: EventCategory;
  tags?: string[];
  imageUrl?: string;
  imageAltText?: string;
  organizerName?: string;
  contactEmail?: string;
  contactPhone?: string;
  cost?: number;
  costDescription?: string;
  contentLanguage?: string; // REQ-055 (E7-S4): ISO 639-1 (de/en/hi) or empty for default
}

export interface UpdateEventRequest extends CreateEventRequest {}

export interface EventFilterOptions {
  search?: string;
  status?: EventStatus;
  visibility?: EventVisibility;
  category?: EventCategory;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export type { PagedResult } from '@/types/common';

export interface EventStatistics {
  total: number;
  published: number;
  draft: number;
  cancelled: number;
  completed: number;
  upcoming: number;
  thisMonth: number;
  thisYear: number;
  byCategory: { category: string; count: number }[];
}

// === Public API (no auth required) ===

export async function getPublicEvents(from?: Date): Promise<ApiResult<EventDto[]>> {
  const params = from ? `?from=${from.toISOString()}` : '';
  return apiGet<EventDto[]>(`/events/public${params}`);
}

export async function getPublicEvent(id: string): Promise<ApiResult<EventDto>> {
  return apiGet<EventDto>(`/events/public/${id}`);
}

// === Protected API (auth required) ===

// A62 retained: reserved for E28 Public pages (Server Components), no in-app caller yet.
export async function getUpcomingEvents(count: number = 10): Promise<ApiResult<EventDto[]>> {
  return apiGet<EventDto[]>(`/events/upcoming?count=${count}`);
}

// A62 cleanup: the protected event CRUD/stats fns (getEvents, getEventById, createEvent,
// updateEvent, publishEvent, unpublishEvent, cancelEvent, deleteEvent, getEventStatistics) were
// removed — the events slice (`features/events/api/events-api.ts` + hooks) is now their sole home
// and no caller imports them from here. The label/format helpers (formatEventDate,
// getStatusBadgeColor, getCategoryLabel, getStatusLabel, getVisibilityLabel) were likewise removed
// (zero importers; the slice has its own `format-event-date.ts` + i18n labels).

// ============================================
// REQ-020: Event Registration / RSVP
// ============================================

export interface EventRegistrationDto {
  id: string;
  eventId: string;
  eventTitle?: string;
  eventStartDate?: string;
  eventLocation?: string;
  userId?: string;
  memberId?: string;
  participantName: string;
  participantEmail: string;
  participantPhone?: string;
  numberOfGuests: number;
  status: RegistrationStatus;
  isWaitlisted: boolean;
  waitlistPosition?: number;
  registeredAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  checkedInAt?: string;
  isNoShow: boolean;
  notes?: string;
  specialRequirements?: string;
  qrCodeToken: string;
  isActive: boolean;
  isCheckedIn: boolean;
  // REQ-022 (E4-S3): payment state derived from the linked finance invoice (E4-S2).
  paymentStatus?: PaymentStatus;
  amountDue?: number | null;
  currency?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
}

/** REQ-022 (E4-S3): payment state for a registration; byte-matches the backend-derived value. */
export type PaymentStatus = 'Paid' | 'Pending' | 'None';

export type RegistrationStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Cancelled'
  | 'Waitlisted'
  | 'CheckedIn'
  | 'NoShow';

export interface EventRegistrationStatistics {
  totalRegistrations: number;
  confirmedCount: number;
  pendingCount: number;
  waitlistedCount: number;
  cancelledCount: number;
  checkedInCount: number;
  noShowCount: number;
  totalParticipants: number;
  totalGuests: number;
}

export interface RegisterPublicRequest {
  name: string;
  email: string;
  phone?: string;
  numberOfGuests?: number;
  specialRequirements?: string;
  // REQ-022 (E4-S3): the chosen fee category for a paid event (optional; auto-resolved server-side
  // when exactly one applicable category exists).
  feeCategoryId?: string;
}

export interface RegisterMemberRequest {
  name?: string;
  email?: string;
  phone?: string;
  memberId?: string;
  numberOfGuests?: number;
  specialRequirements?: string;
  feeCategoryId?: string;
}

export interface UpdateRegistrationRequest {
  participantName: string;
  participantEmail: string;
  participantPhone?: string;
  numberOfGuests: number;
  specialRequirements?: string;
  notes?: string;
}

export interface PagedRegistrationResult {
  items: EventRegistrationDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// === Registration API Functions ===

// A62 retained: reserved for E28 Public pages (Server Components), no in-app caller yet.
export async function registerForEventPublic(
  eventId: string,
  request: RegisterPublicRequest
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPost<EventRegistrationDto>(`/events/${eventId}/registrations/public`, request);
}

// A62 cleanup: the member/manager registration data fns (registerForEvent, getEventRegistrations,
// getEventRegistration, updateEventRegistration, cancelEventRegistration, confirmEventRegistration,
// checkInRegistration, markRegistrationAsNoShow, revertRegistrationNoShow, revertRegistrationCheckIn,
// revertRegistrationCancellation, getEventRegistrationStatistics, getEventWaitlist,
// promoteFromWaitlist, getMyRegistrations) were removed — the detail page + registrations sub-page
// now call the slice (`features/events/api/event-registrations-api.ts`) and nothing imports them
// from here. The registration DTOs above are RETAINED (the slice re-exports them via DEC-3).

// REQ-023 (E3.S2): typed check-in result that includes the WasAlreadyCheckedIn flag and
// typed conflict reasons so the UI doesn't string-match on error messages.
export type CheckInOutcome = 'CheckedIn' | 'AlreadyCheckedIn' | 'NotFound' | 'Conflict';
export type CheckInConflictReason = 'Cancelled' | 'Waitlisted';
export interface CheckInResultDto {
  outcome: CheckInOutcome;
  registration?: EventRegistrationDto | null;
  wasAlreadyCheckedIn: boolean;
  conflict?: CheckInConflictReason | null;
}

// A62 cleanup: the check-in fns (checkInByQrCode, manualCheckIn) were removed — the check-in
// sub-page now calls the slice (`features/events/api/event-check-in-api.ts`). The check-in result
// types above + roster types below are RETAINED (the slice re-exports them via DEC-3).

// REQ-023 (E3.S1): roster surface used by the manual-search fallback list and CSV export.
export interface EventCheckInRosterItemDto {
  registrationId: string;
  qrCodeToken: string;
  participantName: string;
  numberOfGuests: number;
  status: RegistrationStatus;
  isWaitlisted: boolean;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  specialRequirements: string | null;
}
export interface EventCheckInRosterDto {
  eventId: string;
  eventTitle: string;
  eventStartDate: string;
  eventLocation: string;
  generatedAt: string;
  totalRegistrations: number;
  checkedInCount: number;
  items: EventCheckInRosterItemDto[];
}

// A62 cleanup: getEventCheckInRoster removed (the check-in sub-page uses the slice). The roster
// DTOs above are RETAINED (slice re-exports them via DEC-3).

// ============================================
// REQ-024 (E3.S3 + E3.S4): Volunteer planning
// ============================================

export type VolunteerAssignmentStatus = 'Confirmed' | 'Waitlisted' | 'Cancelled';
export type VolunteerErrorCode = 'ShiftFull' | 'SignupNotAllowed' | 'AlreadyAssigned' | 'NoMemberLink';

export interface EventVolunteerRoleDto {
  id: string;
  eventId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface EventVolunteerShiftDto {
  id: string;
  eventId: string;
  roleId: string;
  roleName: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  confirmedCount: number;
  waitlistCount: number;
  allowWaitlist: boolean;
  allowSelfSignup: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface EventVolunteerAssignmentDto {
  id: string;
  shiftId: string;
  roleId: string;
  memberId: string;
  memberDisplayName: string;
  status: VolunteerAssignmentStatus;
  position?: number | null;
  assignedAt: string;
}

// A62 retained: VolunteerSelfSignupSection relies on ApiResult.errorBody.errorCode which
// useApiClient doesn't expose, so the member self-signup flow stays on this service. Its three fns
// (getEventVolunteerShifts, signUpForVolunteerShift, withdrawFromVolunteerShift) are kept; the
// manager volunteer fns (getEventVolunteerRoles, createVolunteerRole, updateVolunteerRole,
// createVolunteerShift, updateVolunteerShift, cancelVolunteerShift, getVolunteerShiftAssignments)
// were removed (A62) — the volunteers sub-page now calls the slice
// (`features/events/api/event-volunteers-api.ts`). CreateVolunteerShiftRequest type is RETAINED
// (slice re-exports it via DEC-3).
export interface CreateVolunteerShiftRequest {
  roleId: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  allowWaitlist: boolean;
  allowSelfSignup: boolean;
  notes?: string | null;
}

export async function getEventVolunteerShifts(eventId: string): Promise<ApiResult<EventVolunteerShiftDto[]>> {
  return apiGet<EventVolunteerShiftDto[]>(`/events/${eventId}/volunteer-shifts/`);
}

export async function signUpForVolunteerShift(
  eventId: string,
  shiftId: string,
  allowWaitlistFallback = false
): Promise<ApiResult<EventVolunteerAssignmentDto>> {
  return apiPost<EventVolunteerAssignmentDto>(
    `/events/${eventId}/volunteer-shifts/${shiftId}/self-signup`,
    { allowWaitlistFallback }
  );
}

export async function withdrawFromVolunteerShift(
  eventId: string,
  shiftId: string,
  assignmentId: string,
  reason?: string
): Promise<ApiResult<EventVolunteerAssignmentDto>> {
  return apiPost<EventVolunteerAssignmentDto>(
    `/events/${eventId}/volunteer-shifts/${shiftId}/assignments/${assignmentId}/cancel`,
    { reason: reason ?? null }
  );
}

// REQ-021: Waitlist position for current user
// A62 cleanup: getMyWaitlistPosition fn removed (no caller); WaitlistPositionDto type RETAINED
// (slice re-exports DTOs via DEC-3 should a sub-page need it).
export interface WaitlistPositionDto {
  registrationId: string;
  eventId: string;
  position: number;
  totalOnWaitlist: number;
  registeredAt: string;
}

// A62 cleanup: the registration label/colour helpers (getRegistrationStatusLabel,
// getRegistrationStatusColor) were removed — zero importers; the slice uses i18n labels + Badge
// variants instead.

// ============================================
// REQ-022 (E4-S1): Event fee categories
// ============================================

/**
 * Who a fee category applies to. String values byte-match the backend `FeeApplicability` enum
 * (PascalCase) so the value round-trips without mapping.
 */
export type FeeApplicability = 'Everyone' | 'MembersOnly' | 'PublicOnly';

/**
 * Currencies a fee may be priced in. Mirrors the backend `FeeCurrencies.Supported` set
 * (CHF / EUR) — kept as ISO-4217 codes so `formatCurrency(amount, currency)` renders the
 * correct symbol per white-label deployment.
 */
export const FEE_CURRENCIES = ['CHF', 'EUR'] as const;
export type FeeCurrency = (typeof FEE_CURRENCIES)[number];

export interface EventFeeCategoryDto {
  id: string;
  eventId: string;
  name: string;
  description?: string | null;
  amount: number;
  currency: string;
  applicability: FeeApplicability;
  availableFrom?: string | null;
  availableUntil?: string | null;
  maxQuantity?: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface SaveFeeCategoryRequest {
  name: string;
  description?: string | null;
  amount: number;
  currency: string;
  applicability: FeeApplicability;
  availableFrom?: string | null;
  availableUntil?: string | null;
  maxQuantity?: number | null;
}

/**
 * REQ-022 (E4-S3): public-facing fee category (no audit/availability internals). Returned by the
 * anonymous public endpoint for the registration page.
 */
export interface PublicFeeCategoryDto {
  id: string;
  name: string;
  description?: string | null;
  amount: number;
  currency: string;
}

// A62 retained: reserved for E28 Public pages (Server Components), no in-app caller yet.
/** REQ-022 (E4-S3): the fee categories a public visitor can pick when registering. */
export async function getPublicEventFeeCategories(
  eventId: string
): Promise<ApiResult<PublicFeeCategoryDto[]>> {
  return apiGet<PublicFeeCategoryDto[]>(`/events/public/${eventId}/fee-categories`);
}

// A62 cleanup: the manager fee-category fns (getEventFeeCategories, createEventFeeCategory,
// updateEventFeeCategory, deactivateEventFeeCategory) were removed — the fees sub-page now calls
// the slice (`features/events/api/event-fees-api.ts`). The fee DTOs + FEE_CURRENCIES above are
// RETAINED (the slice re-exports them via DEC-3).

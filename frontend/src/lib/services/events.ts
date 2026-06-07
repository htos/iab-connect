/**
 * REQ-019: Event Management Service
 * Provides API functions for event management.
 */

import { apiGet, apiPost, apiPut, apiDelete, type ApiResult } from './api';
import type { PagedResult } from '@/types/common';

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

export async function getEvents(
  options?: EventFilterOptions
): Promise<ApiResult<PagedResult<EventDto>>> {
  const params = new URLSearchParams();
  if (options?.search) params.append('search', options.search);
  if (options?.status) params.append('status', options.status);
  if (options?.visibility) params.append('visibility', options.visibility);
  if (options?.category) params.append('category', options.category);
  if (options?.fromDate) params.append('fromDate', options.fromDate);
  if (options?.toDate) params.append('toDate', options.toDate);
  if (options?.page) params.append('page', options.page.toString());
  if (options?.pageSize) params.append('pageSize', options.pageSize.toString());

  const queryString = params.toString() ? `?${params.toString()}` : '';
  return apiGet<PagedResult<EventDto>>(`/events${queryString}`);
}

export async function getUpcomingEvents(count: number = 10): Promise<ApiResult<EventDto[]>> {
  return apiGet<EventDto[]>(`/events/upcoming?count=${count}`);
}

export async function getEventById(id: string): Promise<ApiResult<EventDto>> {
  return apiGet<EventDto>(`/events/${id}`);
}

export async function createEvent(data: CreateEventRequest): Promise<ApiResult<EventDto>> {
  return apiPost<EventDto>('/events', data);
}

export async function updateEvent(
  id: string,
  data: UpdateEventRequest
): Promise<ApiResult<EventDto>> {
  return apiPut<EventDto>(`/events/${id}`, data);
}

export async function publishEvent(id: string): Promise<ApiResult<EventDto>> {
  return apiPost<EventDto>(`/events/${id}/publish`, {});
}

export async function unpublishEvent(id: string): Promise<ApiResult<EventDto>> {
  return apiPost<EventDto>(`/events/${id}/unpublish`, {});
}

export async function cancelEvent(id: string, reason?: string): Promise<ApiResult<EventDto>> {
  return apiPost<EventDto>(`/events/${id}/cancel`, { reason });
}

export async function deleteEvent(id: string): Promise<ApiResult<void>> {
  return apiDelete<void>(`/events/${id}`);
}

export async function getEventStatistics(): Promise<ApiResult<EventStatistics>> {
  return apiGet<EventStatistics>('/events/statistics');
}

// === Utility Functions ===

export function formatEventDate(event: EventDto): string {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);

  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };

  if (event.isAllDay) {
    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString('de-CH', dateOptions);
    }
    return `${start.toLocaleDateString('de-CH', dateOptions)} - ${end.toLocaleDateString('de-CH', dateOptions)}`;
  }

  if (start.toDateString() === end.toDateString()) {
    return `${start.toLocaleDateString('de-CH', dateOptions)}, ${start.toLocaleTimeString('de-CH', timeOptions)} - ${end.toLocaleTimeString('de-CH', timeOptions)}`;
  }

  return `${start.toLocaleDateString('de-CH', { ...dateOptions, hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleDateString('de-CH', { ...dateOptions, hour: '2-digit', minute: '2-digit' })}`;
}

export function getStatusBadgeColor(
  status: EventStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case EventStatus.Published:
      return 'default';
    case EventStatus.Draft:
      return 'secondary';
    case EventStatus.Cancelled:
      return 'destructive';
    case EventStatus.Completed:
      return 'outline';
    default:
      return 'default';
  }
}

export function getCategoryLabel(category: EventCategory): string {
  const labels: Record<EventCategory, string> = {
    [EventCategory.General]: 'Allgemein',
    [EventCategory.Cultural]: 'Kulturell',
    [EventCategory.Social]: 'Gesellschaftlich',
    [EventCategory.Educational]: 'Bildung',
    [EventCategory.Sports]: 'Sport',
    [EventCategory.Religious]: 'Religiös',
    [EventCategory.Charity]: 'Wohltätigkeit',
    [EventCategory.Meeting]: 'Versammlung',
    [EventCategory.Workshop]: 'Workshop',
    [EventCategory.Festival]: 'Festival',
    [EventCategory.Other]: 'Sonstiges',
  };
  return labels[category] || category;
}

export function getStatusLabel(status: EventStatus): string {
  const labels: Record<EventStatus, string> = {
    [EventStatus.Draft]: 'Entwurf',
    [EventStatus.Published]: 'Veröffentlicht',
    [EventStatus.Cancelled]: 'Abgesagt',
    [EventStatus.Completed]: 'Abgeschlossen',
  };
  return labels[status] || status;
}

export function getVisibilityLabel(visibility: EventVisibility): string {
  const labels: Record<EventVisibility, string> = {
    [EventVisibility.Public]: 'Öffentlich',
    [EventVisibility.MembersOnly]: 'Nur Mitglieder',
    [EventVisibility.InviteOnly]: 'Nur auf Einladung',
    [EventVisibility.Hidden]: 'Versteckt',
  };
  return labels[visibility] || visibility;
}

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

export async function registerForEventPublic(
  eventId: string,
  request: RegisterPublicRequest
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPost<EventRegistrationDto>(`/events/${eventId}/registrations/public`, request);
}

export async function registerForEvent(
  eventId: string,
  request: RegisterMemberRequest = {}
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPost<EventRegistrationDto>(`/events/${eventId}/registrations`, request);
}

export async function getEventRegistrations(
  eventId: string,
  params?: {
    status?: RegistrationStatus;
    isWaitlisted?: boolean;
    searchTerm?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<ApiResult<PagedRegistrationResult>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.isWaitlisted !== undefined) searchParams.set('isWaitlisted', String(params.isWaitlisted));
  if (params?.searchTerm) searchParams.set('searchTerm', params.searchTerm);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));

  const query = searchParams.toString();
  return apiGet<PagedRegistrationResult>(`/events/${eventId}/registrations${query ? `?${query}` : ''}`);
}

export async function getEventRegistration(
  eventId: string,
  registrationId: string
): Promise<ApiResult<EventRegistrationDto>> {
  return apiGet<EventRegistrationDto>(`/events/${eventId}/registrations/${registrationId}`);
}

export async function updateEventRegistration(
  eventId: string,
  registrationId: string,
  request: UpdateRegistrationRequest
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPut<EventRegistrationDto>(`/events/${eventId}/registrations/${registrationId}`, request);
}

export async function cancelEventRegistration(
  eventId: string,
  registrationId: string,
  reason?: string
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPost<EventRegistrationDto>(`/events/${eventId}/registrations/${registrationId}/cancel`, { reason });
}

export async function confirmEventRegistration(
  eventId: string,
  registrationId: string
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPost<EventRegistrationDto>(`/events/${eventId}/registrations/${registrationId}/confirm`, {});
}

export async function checkInRegistration(
  eventId: string,
  registrationId: string
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPost<EventRegistrationDto>(`/events/${eventId}/registrations/${registrationId}/check-in`, {});
}

export async function markRegistrationAsNoShow(
  eventId: string,
  registrationId: string
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPost<EventRegistrationDto>(`/events/${eventId}/registrations/${registrationId}/no-show`, {});
}

export async function revertRegistrationNoShow(
  eventId: string,
  registrationId: string
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPost<EventRegistrationDto>(`/events/${eventId}/registrations/${registrationId}/revert-no-show`, {});
}

export async function revertRegistrationCheckIn(
  eventId: string,
  registrationId: string
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPost<EventRegistrationDto>(`/events/${eventId}/registrations/${registrationId}/revert-check-in`, {});
}

export async function revertRegistrationCancellation(
  eventId: string,
  registrationId: string
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPost<EventRegistrationDto>(`/events/${eventId}/registrations/${registrationId}/revert-cancellation`, {});
}

export async function getEventRegistrationStatistics(
  eventId: string
): Promise<ApiResult<EventRegistrationStatistics>> {
  return apiGet<EventRegistrationStatistics>(`/events/${eventId}/registrations/statistics`);
}

export async function getEventWaitlist(
  eventId: string
): Promise<ApiResult<EventRegistrationDto[]>> {
  return apiGet<EventRegistrationDto[]>(`/events/${eventId}/registrations/waitlist`);
}

export async function promoteFromWaitlist(
  eventId: string
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPost<EventRegistrationDto>(`/events/${eventId}/registrations/promote-from-waitlist`, {});
}

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

export async function checkInByQrCode(
  qrCodeToken: string
): Promise<ApiResult<CheckInResultDto>> {
  // Post-review H-S2-3: URL-encode the token. Tokens containing `/`, `?`, `#`, or spaces
  // would otherwise corrupt the route and produce surprising 404s or partial matches.
  return apiPost<CheckInResultDto>(
    `/registrations/check-in/${encodeURIComponent(qrCodeToken)}`,
    {}
  );
}

// REQ-023 (E3.S2): manual-search check-in — staff selects a roster row, optional
// searchQuery hashed into searchQueryHash at the backend's audit log.
export async function manualCheckIn(
  eventId: string,
  registrationId: string,
  searchQuery?: string
): Promise<ApiResult<CheckInResultDto>> {
  return apiPost<CheckInResultDto>(
    `/events/${eventId}/registrations/${registrationId}/manual-check-in`,
    { searchQuery: searchQuery ?? null }
  );
}

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

export async function getEventCheckInRoster(
  eventId: string,
  options?: { includeWaitlisted?: boolean }
): Promise<ApiResult<EventCheckInRosterDto>> {
  const params = new URLSearchParams();
  if (options?.includeWaitlisted) params.set('includeWaitlisted', 'true');
  const qs = params.toString();
  return apiGet<EventCheckInRosterDto>(
    `/events/${eventId}/registrations/check-in-roster${qs ? `?${qs}` : ''}`
  );
}

export async function getMyRegistrations(): Promise<ApiResult<EventRegistrationDto[]>> {
  return apiGet<EventRegistrationDto[]>('/my-registrations');
}

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

export async function getEventVolunteerRoles(eventId: string): Promise<ApiResult<EventVolunteerRoleDto[]>> {
  return apiGet<EventVolunteerRoleDto[]>(`/events/${eventId}/volunteer-roles/`);
}

export async function createVolunteerRole(
  eventId: string,
  request: { name: string; description?: string | null }
): Promise<ApiResult<EventVolunteerRoleDto>> {
  return apiPost<EventVolunteerRoleDto>(`/events/${eventId}/volunteer-roles/`, request);
}

export async function updateVolunteerRole(
  eventId: string,
  roleId: string,
  request: { name: string; description?: string | null; isActive: boolean }
): Promise<ApiResult<EventVolunteerRoleDto>> {
  return apiPut<EventVolunteerRoleDto>(`/events/${eventId}/volunteer-roles/${roleId}`, request);
}

export async function getEventVolunteerShifts(eventId: string): Promise<ApiResult<EventVolunteerShiftDto[]>> {
  return apiGet<EventVolunteerShiftDto[]>(`/events/${eventId}/volunteer-shifts/`);
}

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

export async function createVolunteerShift(
  eventId: string,
  request: CreateVolunteerShiftRequest
): Promise<ApiResult<EventVolunteerShiftDto>> {
  return apiPost<EventVolunteerShiftDto>(`/events/${eventId}/volunteer-shifts/`, request);
}

export async function updateVolunteerShift(
  eventId: string,
  shiftId: string,
  request: Omit<CreateVolunteerShiftRequest, 'roleId'>
): Promise<ApiResult<EventVolunteerShiftDto>> {
  return apiPut<EventVolunteerShiftDto>(`/events/${eventId}/volunteer-shifts/${shiftId}`, request);
}

export async function cancelVolunteerShift(
  eventId: string,
  shiftId: string,
  reason?: string
): Promise<ApiResult<{ cancelledAssignmentCount: number }>> {
  return apiPost<{ cancelledAssignmentCount: number }>(
    `/events/${eventId}/volunteer-shifts/${shiftId}/cancel`,
    { reason: reason ?? null }
  );
}

export async function getVolunteerShiftAssignments(
  eventId: string,
  shiftId: string
): Promise<ApiResult<EventVolunteerAssignmentDto[]>> {
  return apiGet<EventVolunteerAssignmentDto[]>(
    `/events/${eventId}/volunteer-shifts/${shiftId}/assignments`
  );
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
export interface WaitlistPositionDto {
  registrationId: string;
  eventId: string;
  position: number;
  totalOnWaitlist: number;
  registeredAt: string;
}

export async function getMyWaitlistPosition(
  eventId: string
): Promise<ApiResult<WaitlistPositionDto>> {
  return apiGet<WaitlistPositionDto>(`/events/${eventId}/registrations/my-position`);
}

// === Registration Utility Functions ===

export function getRegistrationStatusLabel(status: RegistrationStatus): string {
  const labels: Record<RegistrationStatus, string> = {
    Pending: 'Ausstehend',
    Confirmed: 'Bestätigt',
    Cancelled: 'Storniert',
    Waitlisted: 'Warteliste',
    CheckedIn: 'Eingecheckt',
    NoShow: 'Nicht erschienen',
  };
  return labels[status] || status;
}

export function getRegistrationStatusColor(
  status: RegistrationStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'Confirmed':
    case 'CheckedIn':
      return 'default';
    case 'Pending':
    case 'Waitlisted':
      return 'secondary';
    case 'Cancelled':
    case 'NoShow':
      return 'destructive';
    default:
      return 'outline';
  }
}

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

/** REQ-022 (E4-S3): the fee categories a public visitor can pick when registering. */
export async function getPublicEventFeeCategories(
  eventId: string
): Promise<ApiResult<PublicFeeCategoryDto[]>> {
  return apiGet<PublicFeeCategoryDto[]>(`/events/public/${eventId}/fee-categories`);
}

export async function getEventFeeCategories(
  eventId: string,
  options?: { includeInactive?: boolean }
): Promise<ApiResult<EventFeeCategoryDto[]>> {
  const params = new URLSearchParams();
  if (options?.includeInactive === false) params.set('includeInactive', 'false');
  const qs = params.toString();
  return apiGet<EventFeeCategoryDto[]>(
    `/events/${eventId}/fee-categories/${qs ? `?${qs}` : ''}`
  );
}

export async function createEventFeeCategory(
  eventId: string,
  request: SaveFeeCategoryRequest
): Promise<ApiResult<EventFeeCategoryDto>> {
  return apiPost<EventFeeCategoryDto>(`/events/${eventId}/fee-categories/`, request);
}

export async function updateEventFeeCategory(
  eventId: string,
  categoryId: string,
  request: SaveFeeCategoryRequest
): Promise<ApiResult<EventFeeCategoryDto>> {
  return apiPut<EventFeeCategoryDto>(
    `/events/${eventId}/fee-categories/${categoryId}`,
    request
  );
}

export async function deactivateEventFeeCategory(
  eventId: string,
  categoryId: string
): Promise<ApiResult<EventFeeCategoryDto>> {
  return apiPost<EventFeeCategoryDto>(
    `/events/${eventId}/fee-categories/${categoryId}/deactivate`,
    {}
  );
}

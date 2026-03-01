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
}

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
}

export interface RegisterMemberRequest {
  name?: string;
  email?: string;
  phone?: string;
  memberId?: string;
  numberOfGuests?: number;
  specialRequirements?: string;
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

export async function checkInByQrCode(
  qrCodeToken: string
): Promise<ApiResult<EventRegistrationDto>> {
  return apiPost<EventRegistrationDto>(`/registrations/check-in/${qrCodeToken}`, {});
}

export async function getMyRegistrations(): Promise<ApiResult<EventRegistrationDto[]>> {
  return apiGet<EventRegistrationDto[]>('/my-registrations');
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

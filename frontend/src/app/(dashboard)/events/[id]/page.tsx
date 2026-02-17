/**
 * REQ-019: Event Detail Page
 * Displays detailed information about a single event - with i18n support
 */
'use client';

import { useEffect, useState, use, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth';

interface EventDto {
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
  maxParticipants?: number;
  registrationRequired: boolean;
  registrationDeadline?: string;
  waitlistEnabled: boolean;
  visibility: string;
  status: string;
  category: string;
  imageUrl?: string;
  imageAltText?: string;
  cost?: number;
  costDescription?: string;
  isFree: boolean;
  hasStarted: boolean;
  hasEnded: boolean;
  isRegistrationOpen: boolean;
  tags: string[];
  organizerName?: string;
  contactEmail?: string;
  contactPhone?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
}

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-800',
  Published: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
  Completed: 'bg-blue-100 text-blue-800',
};

function formatEventDate(event: EventDto, locale: string): string {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const localeCode = locale === 'de' ? 'de-CH' : 'en-US';
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };

  if (event.isAllDay) {
    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString(localeCode, dateOptions);
    }
    return `${start.toLocaleDateString(localeCode, dateOptions)} - ${end.toLocaleDateString(localeCode, dateOptions)}`;
  }

  if (start.toDateString() === end.toDateString()) {
    return `${start.toLocaleDateString(localeCode, dateOptions)}, ${start.toLocaleTimeString(localeCode, timeOptions)} - ${end.toLocaleTimeString(localeCode, timeOptions)}`;
  }
  return `${start.toLocaleDateString(localeCode, dateOptions)} ${start.toLocaleTimeString(localeCode, timeOptions)} - ${end.toLocaleDateString(localeCode, dateOptions)} ${end.toLocaleTimeString(localeCode, timeOptions)}`;
}

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default function EventPage({ params }: EventPageProps) {
  const resolvedParams = use(params);
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const { isAuthenticated, isLoading: authLoading, accessToken, isVorstand, isAdmin } = useAuth();
  const router = useRouter();

  const [event, setEvent] = useState<EventDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
  const canManageEvents = isVorstand || isAdmin;
  const canDeleteEvents = isAdmin;

  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  const loadEvent = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/api/v1/events/${resolvedParams.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(t('errors.notFound'));
        }
        throw new Error(t('errors.loadFailed'));
      }

      const data: EventDto = await response.json();
      setEvent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [baseUrl, resolvedParams.id, t, tCommon]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (!authLoading && isAuthenticated && accessToken) {
      loadEvent();
    }
  }, [authLoading, isAuthenticated, accessToken, router, loadEvent]);

  const handlePublish = async () => {
    if (!event || !accessToken) return;
    setActionLoading(true);

    try {
      const response = await fetch(`${baseUrl}/api/v1/events/${event.id}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEvent(data);
      } else {
        setError(t('errors.publishFailed'));
      }
    } catch {
      setError(t('errors.publishFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!event || !accessToken) return;
    setActionLoading(true);

    try {
      const response = await fetch(`${baseUrl}/api/v1/events/${event.id}/unpublish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEvent(data);
      } else {
        setError(t('errors.unpublishFailed'));
      }
    } catch {
      setError(t('errors.unpublishFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!event || !accessToken) return;
    setActionLoading(true);

    try {
      const response = await fetch(`${baseUrl}/api/v1/events/${event.id}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: cancelReason || undefined }),
      });

      if (response.ok) {
        const data = await response.json();
        setEvent(data);
        setCancelReason('');
        setShowCancelDialog(false);
      } else {
        setError(t('errors.cancelFailed'));
      }
    } catch {
      setError(t('errors.cancelFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !accessToken) return;
    setActionLoading(true);

    try {
      const response = await fetch(`${baseUrl}/api/v1/events/${event.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        router.push('/events');
      } else {
        setError(t('errors.deleteFailed'));
        setActionLoading(false);
      }
    } catch {
      setError(t('errors.deleteFailed'));
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded bg-gray-200" />
            <div className="h-64 rounded-xl bg-gray-200" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-48 rounded-xl bg-gray-200" />
              <div className="h-48 rounded-xl bg-gray-200" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error || !event) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="mx-auto h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{error || t('errors.notFound')}</h2>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 mt-4 text-orange-600 hover:text-orange-700 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t('actions.backToEvents')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        {/* Back Link */}
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-600 mb-6 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('actions.backToEvents')}
        </Link>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900 font-bold text-xl">×</button>
          </div>
        )}

        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          {/* Event Image */}
          {event.imageUrl ? (
            <div className="h-64 md:h-80 relative">
              <Image src={event.imageUrl} alt={event.imageAltText || event.title} className="w-full h-full object-cover" fill sizes="100vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[event.status] || 'bg-gray-100 text-gray-800'}`}>
                    {t(`status.${event.status.toLowerCase()}`)}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    {t(`category.${event.category.toLowerCase()}`)}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                    {t(`visibility.${event.visibility.toLowerCase()}`)}
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold">{event.title}</h1>
              </div>
            </div>
          ) : (
            <div className="h-48 bg-gradient-to-br from-orange-400 to-orange-600 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-20 h-20 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[event.status] || 'bg-gray-100 text-gray-800'}`}>
                    {t(`status.${event.status.toLowerCase()}`)}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    {t(`category.${event.category.toLowerCase()}`)}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                    {t(`visibility.${event.visibility.toLowerCase()}`)}
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold">{event.title}</h1>
              </div>
            </div>
          )}

          {/* Action Bar */}
          {canManageEvents && (
            <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-3">
              <Link href={`/events/${event.id}/edit`} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('actions.edit')}
              </Link>

              {event.status === 'Draft' && (
                <button onClick={handlePublish} disabled={actionLoading} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('actions.publish')}
                </button>
              )}

              {event.status === 'Published' && (
                <>
                  <button onClick={handleUnpublish} disabled={actionLoading} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {t('actions.unpublish')}
                  </button>
                  <button onClick={() => setShowCancelDialog(true)} disabled={actionLoading} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {t('actions.cancel')}
                  </button>
                </>
              )}

              {canDeleteEvents && (
                <button onClick={() => setShowDeleteDialog(true)} disabled={actionLoading} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('actions.delete')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('detail.description')}</h2>
              <div className="prose prose-sm max-w-none text-gray-600">
                {event.description.split('\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>

            {/* Cancellation Reason */}
            {event.status === 'Cancelled' && event.cancellationReason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-red-800 mb-2">{t('detail.cancellationReason')}</h2>
                <p className="text-red-700">{event.cancellationReason}</p>
              </div>
            )}

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('form.tags')}</h2>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Info Cards */}
          <div className="space-y-6">
            {/* Date & Time */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{t('detail.dateTime')}</h2>
              </div>
              <p className="text-gray-600">{formatEventDate(event, 'de')}</p>
              {event.isAllDay && (
                <span className="inline-flex items-center mt-2 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  {t('form.allDayEvent')}
                </span>
              )}
            </div>

            {/* Location */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{t('detail.location')}</h2>
              </div>
              <p className="font-medium text-gray-900">{event.location}</p>
              {event.locationAddress && <p className="text-gray-600 text-sm mt-1">{event.locationAddress}</p>}
              {event.locationUrl && (
                <a href={event.locationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-sm text-orange-600 hover:text-orange-700">
                  {t('detail.viewOnMap')}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>

            {/* Cost */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{t('detail.cost')}</h2>
              </div>
              {event.isFree ? (
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">{t('detail.freeEvent')}</span>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-900">CHF {event.cost?.toFixed(2)}</p>
                  {event.costDescription && <p className="text-sm text-gray-600 mt-1">{event.costDescription}</p>}
                </>
              )}
            </div>

            {/* Registration */}
            {event.registrationRequired && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{t('registration.title')}</h2>
                </div>
                <div className="space-y-2 text-sm">
                  {event.maxParticipants && (
                    <p className="text-gray-600">{t('registration.maxParticipants')}: <span className="font-medium text-gray-900">{event.maxParticipants}</span></p>
                  )}
                  {event.registrationDeadline && (
                    <p className="text-gray-600">{t('registration.deadline')}: <span className="font-medium text-gray-900">
                      {new Date(event.registrationDeadline).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span></p>
                  )}
                  {event.waitlistEnabled && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">{t('registration.waitlistEnabled')}</span>
                  )}
                  {event.isRegistrationOpen ? (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">{t('registration.open')}</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">{t('registration.closed')}</span>
                  )}
                </div>
              </div>
            )}

            {/* Contact */}
            {(event.organizerName || event.contactEmail || event.contactPhone) && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{t('detail.contact')}</h2>
                </div>
                <div className="space-y-2 text-sm">
                  {event.organizerName && <p className="font-medium text-gray-900">{event.organizerName}</p>}
                  {event.contactEmail && (
                    <a href={`mailto:${event.contactEmail}`} className="flex items-center gap-2 text-orange-600 hover:text-orange-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {event.contactEmail}
                    </a>
                  )}
                  {event.contactPhone && (
                    <a href={`tel:${event.contactPhone}`} className="flex items-center gap-2 text-orange-600 hover:text-orange-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {event.contactPhone}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cancel Dialog */}
        {showCancelDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('actions.cancelEvent')}</h3>
              <p className="text-gray-600 text-sm mb-4">{t('actions.confirmCancelDesc')}</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.cancelReason')}</label>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={t('form.cancelReasonPlaceholder')} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors resize-none" />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setShowCancelDialog(false); setCancelReason(''); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">{tCommon('back')}</button>
                <button onClick={handleCancel} disabled={actionLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors">{actionLoading ? tCommon('loading') : t('actions.cancel')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Dialog */}
        {showDeleteDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('actions.deleteEvent')}</h3>
              <p className="text-gray-600 text-sm mb-4">{t('actions.confirmDeleteDesc')}</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowDeleteDialog(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">{tCommon('back')}</button>
                <button onClick={handleDelete} disabled={actionLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors">{actionLoading ? tCommon('loading') : t('actions.delete')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

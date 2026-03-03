/**
 * REQ-019: Events Page
 * Displays list of events with filtering - with i18n support
 */
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  maxParticipants?: number;
  registrationRequired: boolean;
  waitlistEnabled: boolean;
  visibility: string;
  status: string;
  category: string;
  imageUrl?: string;
  cost?: number;
  isFree: boolean;
  hasStarted: boolean;
  hasEnded: boolean;
  isRegistrationOpen: boolean;
}

interface EventStatistics {
  totalEvents: number;
  upcomingEvents: number;
  publishedEvents: number;
  draftEvents: number;
}

interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
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
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };

  if (event.isAllDay) {
    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString(localeCode, options);
    }
    return `${start.toLocaleDateString(localeCode, options)} - ${end.toLocaleDateString(localeCode, options)}`;
  }

  if (start.toDateString() === end.toDateString()) {
    return `${start.toLocaleDateString(localeCode, options)}, ${start.toLocaleTimeString(localeCode, timeOptions)} - ${end.toLocaleTimeString(localeCode, timeOptions)}`;
  }
  return `${start.toLocaleDateString(localeCode, options)} ${start.toLocaleTimeString(localeCode, timeOptions)} - ${end.toLocaleDateString(localeCode, options)} ${end.toLocaleTimeString(localeCode, timeOptions)}`;
}

export default function EventsPage() {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const { isAuthenticated, isLoading: authLoading, accessToken, isVorstand, isAdmin } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<EventDto[]>([]);
  const [statistics, setStatistics] = useState<EventStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
  const canManageEvents = isVorstand || isAdmin;

  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  const fetchEvents = useCallback(
    async (currentPage: number, search: string, status: string, category: string) => {
      const token = accessTokenRef.current;
      if (!token) return;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.append('page', currentPage.toString());
        params.append('pageSize', '12');
        if (search) params.append('search', search);
        if (status) params.append('status', status);
        if (category) params.append('category', category);

        const response = await fetch(`${baseUrl}/api/v1/events?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(t('errors.loadFailed'));
        }

        const data: PagedResponse<EventDto> = await response.json();
        setEvents(data.items);
        setTotalPages(data.totalPages);
        setTotalCount(data.totalCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : tCommon('error'));
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, t, tCommon]
  );

  const fetchStatistics = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token || !canManageEvents) return;

    try {
      const response = await fetch(`${baseUrl}/api/v1/events/statistics`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: EventStatistics = await response.json();
        setStatistics(data);
      }
    } catch {
      // Statistics are optional - ignore errors
    }
  }, [baseUrl, canManageEvents]);

  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (!authLoading && isAuthenticated && accessToken && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchEvents(page, searchTerm, statusFilter, categoryFilter);
      fetchStatistics();
    }
  }, [authLoading, isAuthenticated, accessToken, router, fetchEvents, fetchStatistics, page, searchTerm, statusFilter, categoryFilter]);

  useEffect(() => {
    if (initialFetchDone.current && accessToken) {
      const timeoutId = setTimeout(() => {
        fetchEvents(page, searchTerm, statusFilter, categoryFilter);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [page, searchTerm, statusFilter, categoryFilter, fetchEvents, accessToken]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleStatusFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const handleCategoryFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value);
    setPage(1);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="h-6 w-6 animate-spin text-orange-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-gray-600">{tCommon('loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
            <p className="mt-2 text-gray-500">
              {t('totalEvents', { count: totalCount })}
            </p>
          </div>
          {canManageEvents && (
            <Link
              href="/events/new"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('createEvent')}
            </Link>
          )}
        </div>

        {/* Statistics (for Vorstand/Admin) */}
        {canManageEvents && statistics && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">{tCommon('total')}</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.totalEvents}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">{t('status.published')}</p>
              <p className="text-2xl font-bold text-green-600">{statistics.publishedEvents}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">{t('status.draft')}</p>
              <p className="text-2xl font-bold text-gray-600">{statistics.draftEvents}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">{t('detail.participants')}</p>
              <p className="text-2xl font-bold text-blue-600">{statistics.upcomingEvents}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={handleSearch}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={handleCategoryFilter}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors bg-white"
            >
              <option value="">{t('allCategories')}</option>
              <option value="General">{t('category.general')}</option>
              <option value="Cultural">{t('category.cultural')}</option>
              <option value="Religious">{t('category.religious')}</option>
              <option value="Social">{t('category.social')}</option>
              <option value="Sports">{t('category.sports')}</option>
              <option value="Educational">{t('category.educational')}</option>
              <option value="Charity">{t('category.charity')}</option>
              <option value="Meeting">{t('category.meeting')}</option>
              <option value="Workshop">{t('category.workshop')}</option>
              <option value="Festival">{t('category.festival')}</option>
              <option value="Other">{t('category.other')}</option>
            </select>

            {/* Status Filter (only for managers) */}
            {canManageEvents && (
              <select
                value={statusFilter}
                onChange={handleStatusFilter}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors bg-white"
              >
                <option value="">{t('allStatuses')}</option>
                <option value="Draft">{t('status.draft')}</option>
                <option value="Published">{t('status.published')}</option>
                <option value="Cancelled">{t('status.cancelled')}</option>
                <option value="Completed">{t('status.completed')}</option>
              </select>
            )}

            {/* View Toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-gray-300 p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`rounded p-1.5 ${viewMode === 'grid' ? 'bg-orange-100 text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`rounded p-1.5 ${viewMode === 'list' ? 'bg-orange-100 text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800">{error}</p>
              <button
                onClick={() => fetchEvents(page, searchTerm, statusFilter, categoryFilter)}
                className="ml-auto text-sm text-red-600 hover:text-red-800 underline"
              >
                {tCommon('tryAgain')}
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <svg className="h-8 w-8 animate-spin text-orange-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        {/* Empty State */}
        {!loading && events.length === 0 && (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">{t('noEvents')}</h3>
            <p className="mt-2 text-gray-500">{t('noEventsDescription')}</p>
            {canManageEvents && (
              <Link
                href="/events/new"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('createEvent')}
              </Link>
            )}
          </div>
        )}

        {/* Events Grid */}
        {!loading && events.length > 0 && viewMode === 'grid' && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group rounded-xl bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Event Image */}
                <div className="aspect-video bg-linear-to-br from-orange-100 to-orange-200 relative">
                  {event.imageUrl ? (
                    <Image
                      src={event.imageUrl}
                      alt={event.title}
                      className="h-full w-full object-cover"
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <svg className="h-12 w-12 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {/* Status Badge */}
                  <span className={`absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full ${statusColors[event.status] || 'bg-gray-100 text-gray-800'}`}>
                    {t(`status.${event.status.toLowerCase()}`)}
                  </span>
                </div>

                {/* Event Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-1">
                    {event.title}
                  </h3>

                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="line-clamp-1">{formatEventDate(event, 'de')}</span>
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="line-clamp-1">{event.location}</span>
                  </div>

                  {/* Tags */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                      {t(`category.${event.category.toLowerCase()}`)}
                    </span>
                    {event.isFree && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        {t('detail.freeEvent')}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Events List View */}
        {!loading && events.length > 0 && viewMode === 'list' && (
          <div className="rounded-xl bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('form.title')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('detail.dateTime')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('detail.location')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('filterByCategory')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('filterByStatus')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/events/${event.id}`)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{event.title}</div>
                      {event.shortDescription && (
                        <div className="text-sm text-gray-500 line-clamp-1">{event.shortDescription}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatEventDate(event, 'de')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {event.location}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                        {t(`category.${event.category.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[event.status] || 'bg-gray-100 text-gray-800'}`}>
                        {t(`status.${event.status.toLowerCase()}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">
              {tCommon('page')} {page} {tCommon('of')} {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {tCommon('previous')}
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {tCommon('next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

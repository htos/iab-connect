/**
 * REQ-019: Event Detail composition root (E24-S2).
 *
 * The single `"use client"` boundary for `/events/[id]`, extracted from the
 * ~996-line god-page. Behaviour-preserving: the rendered output, i18n keys,
 * action-bar affordance gating, load-error views, publish/unpublish/cancel/
 * delete flows, manager registration-stats + waitlist sections, the member
 * registration section, and the always-rendered `<VolunteerSelfSignupSection />`
 * are reproduced exactly.
 *
 * DEC-2 (the ONLY transport that moved): the EVENT itself + publish / unpublish
 * / cancel / delete go through the slice hooks (`useEvent`,
 * `useEventDetailMutations`) which use `useApiClient`. E24-S3 SEAM-CLOSE: the
 * registration / waitlist surface (`getEventRegistrationStatistics`,
 * `getEventWaitlist`, `promoteFromWaitlist`, `registerForEvent`,
 * `getMyRegistrations`, `cancelEventRegistration`) NOW goes through the slice
 * `event-registrations-api` via a `useApiClient()` instance — byte-identical
 * URLs/bodies to the old service. The imperative flow (Promise.all stats+waitlist
 * with silent fail, `regSuccess` local state, `result.error` → error banner) is
 * preserved verbatim, so the slice HOOKS (which throw + invalidate) don't fit;
 * the api functions are called directly with the threaded `api` client. ONLY the
 * always-rendered `<VolunteerSelfSignupSection />` stays on
 * `events` (it relies on `ApiResult.errorBody.errorCode`, which
 * `useApiClient` cannot express). The hand-rolled fixed-overlay confirm dialogs
 * are preserved.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { VolunteerSelfSignupSection } from "@/app/(dashboard)/events/[id]/VolunteerSelfSignupSection";
import { useEvent, EventNotFoundError } from "../hooks/use-event";
import { useEventDetailMutations } from "../hooks/use-event-detail-mutations";
import {
  getEventRegistrationStatistics,
  getEventWaitlist,
  promoteFromWaitlist,
  registerForEvent,
  getMyRegistrations,
  cancelEventRegistration,
} from "../api/event-registrations-api";
import { statusColors } from "./event-status-badge";
import type {
  EventDto,
  EventRegistrationDto,
  EventRegistrationStatistics,
} from "../types/events.types";

function formatEventDate(event: EventDto, locale: string): string {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const localeCode = locale === "de" ? "de-CH" : "en-US";
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
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

interface EventDetailProps {
  id: string;
}

export function EventDetail({ id }: EventDetailProps) {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();
  // E24-S3 seam-close: the registration/waitlist api functions take a client
  // instance; thread one in so the imperative flow keeps its exact shape.
  const api = useApiClient();

  // Event server-state via the slice (DEC-2): the GET that used a raw `fetch`
  // is now a TanStack query through `useApiClient`. `enabled` mirrors the page's
  // auth gate so no GET fires before authentication resolves.
  const {
    data: event,
    isLoading: loading,
    error: queryError,
  } = useEvent(id, isAuthenticated && !authLoading);
  const mutations = useEventDetailMutations(id);

  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [regStats, setRegStats] = useState<EventRegistrationStatistics | null>(
    null
  );
  const [waitlistEntries, setWaitlistEntries] = useState<
    EventRegistrationDto[]
  >([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [promoteLoading, setPromoteLoading] = useState(false);

  // Member registration state
  const [myRegistration, setMyRegistration] =
    useState<EventRegistrationDto | null>(null);
  const [myRegLoading, setMyRegLoading] = useState(false);
  const [showRegForm, setShowRegForm] = useState(false);
  const [regNumberOfGuests, setRegNumberOfGuests] = useState(0);
  const [regSpecialRequirements, setRegSpecialRequirements] = useState("");
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regSuccess, setRegSuccess] = useState<{
    isWaitlisted: boolean;
    waitlistPosition?: number;
  } | null>(null);
  const [cancellingReg, setCancellingReg] = useState(false);
  const [showCancelRegDialog, setShowCancelRegDialog] = useState(false);
  const [cancelRegReason, setCancelRegReason] = useState("");

  const canManageEvents = isVorstand || isAdmin;
  const canDeleteEvents = isAdmin;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const loadRegistrationData = useCallback(async () => {
    if (!canManageEvents || !event?.registrationRequired) return;
    setWaitlistLoading(true);
    try {
      const [statsResult, waitlistResult] = await Promise.all([
        getEventRegistrationStatistics(api, id),
        event.waitlistEnabled
          ? getEventWaitlist(api, id)
          : Promise.resolve({
              data: [] as EventRegistrationDto[],
              error: undefined,
            }),
      ]);
      if (statsResult.data) setRegStats(statsResult.data);
      if (waitlistResult.data) setWaitlistEntries(waitlistResult.data);
    } catch {
      // Silent fail - stats are supplementary info
    } finally {
      setWaitlistLoading(false);
    }
  }, [
    api,
    canManageEvents,
    event?.registrationRequired,
    event?.waitlistEnabled,
    id,
  ]);

  useEffect(() => {
    if (event && canManageEvents) {
      loadRegistrationData();
    }
  }, [event, canManageEvents, loadRegistrationData]);

  const handlePromoteFromWaitlist = async () => {
    setPromoteLoading(true);
    try {
      const result = await promoteFromWaitlist(api, id);
      if (result.data) {
        await loadRegistrationData();
      } else {
        setError(t("registration.promoteFailed"));
      }
    } catch {
      setError(t("registration.promoteFailed"));
    } finally {
      setPromoteLoading(false);
    }
  };

  // Load current user's registration for this event
  const loadMyRegistration = useCallback(async () => {
    if (!event?.registrationRequired) return;
    setMyRegLoading(true);
    try {
      const result = await getMyRegistrations(api);
      if (result.data) {
        const mine = result.data.find(
          (r) => r.eventId === id && r.status !== "Cancelled"
        );
        setMyRegistration(mine ?? null);
      }
    } catch {
      // Silent fail
    } finally {
      setMyRegLoading(false);
    }
  }, [api, event?.registrationRequired, id]);

  useEffect(() => {
    if (event && isAuthenticated) {
      loadMyRegistration();
    }
  }, [event, isAuthenticated, loadMyRegistration]);

  const handleRegister = async () => {
    setRegSubmitting(true);
    setRegSuccess(null);
    try {
      const result = await registerForEvent(api, id, {
        numberOfGuests: regNumberOfGuests,
        specialRequirements: regSpecialRequirements || undefined,
      });
      if (result.data) {
        setRegSuccess({
          isWaitlisted: result.data.isWaitlisted,
          waitlistPosition: result.data.waitlistPosition,
        });
        setMyRegistration(result.data);
        setShowRegForm(false);
        setRegNumberOfGuests(0);
        setRegSpecialRequirements("");
        if (canManageEvents) await loadRegistrationData();
      } else {
        setError(result.error || t("registration.registrationFailed"));
      }
    } catch {
      setError(t("registration.registrationFailed"));
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleCancelMyRegistration = async () => {
    if (!myRegistration) return;
    setCancellingReg(true);
    try {
      const result = await cancelEventRegistration(
        api,
        id,
        myRegistration.id,
        cancelRegReason || undefined
      );
      if (result.data) {
        setMyRegistration(null);
        setShowCancelRegDialog(false);
        setCancelRegReason("");
        setRegSuccess(null);
        if (canManageEvents) await loadRegistrationData();
      } else {
        setError(result.error || t("registration.cancelFailed"));
      }
    } catch {
      setError(t("registration.cancelFailed"));
    } finally {
      setCancellingReg(false);
    }
  };

  const handlePublish = async () => {
    if (!event) return;
    setActionLoading(true);
    mutations.publish.mutate(undefined, {
      onError: () => setError(t("errors.publishFailed")),
      onSettled: () => setActionLoading(false),
    });
  };

  const handleUnpublish = async () => {
    if (!event) return;
    setActionLoading(true);
    mutations.unpublish.mutate(undefined, {
      onError: () => setError(t("errors.unpublishFailed")),
      onSettled: () => setActionLoading(false),
    });
  };

  const handleCancel = async () => {
    if (!event) return;
    setActionLoading(true);
    mutations.cancel.mutate(cancelReason || undefined, {
      onSuccess: () => {
        setCancelReason("");
        setShowCancelDialog(false);
      },
      onError: () => setError(t("errors.cancelFailed")),
      onSettled: () => setActionLoading(false),
    });
  };

  const handleDelete = async () => {
    if (!event) return;
    setActionLoading(true);
    mutations.remove.mutate(undefined, {
      onSuccess: () => router.push("/events"),
      onError: () => {
        setError(t("errors.deleteFailed"));
        setActionLoading(false);
      },
    });
  };

  if (authLoading || loading) {
    return (
      <PageShell maxWidth="5xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="h-64 rounded-xl bg-gray-200" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="h-48 rounded-xl bg-gray-200 lg:col-span-2" />
            <div className="h-48 rounded-xl bg-gray-200" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (queryError || error || !event) {
    const message =
      queryError instanceof EventNotFoundError
        ? t("errors.notFound")
        : queryError
          ? t("errors.loadFailed")
          : error || t("errors.notFound");
    return (
      <PageShell maxWidth="5xl">
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-10 w-10 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            {message}
          </h2>
          <Link
            href="/events"
            className="mt-4 inline-flex items-center gap-2 font-medium text-orange-600 hover:text-orange-700"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            {t("actions.backToEvents")}
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="5xl">
      {/* Back Link */}
      <Link
        href="/events"
        className="mb-6 inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-orange-600"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        {t("actions.backToEvents")}
      </Link>

      {/* Error Message */}
      {error && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xl font-bold text-red-700 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      {/* Header Card */}
      <div className="mb-6 overflow-hidden rounded-xl bg-white shadow-sm">
        {/* Event Image */}
        {event.imageUrl ? (
          <div className="relative h-64 md:h-80">
            <Image
              src={event.imageUrl}
              alt={event.imageAltText || event.title}
              className="h-full w-full object-cover"
              fill
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
            <div className="absolute right-0 bottom-0 left-0 p-6 text-white">
              <div className="mb-3 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[event.status] || "bg-gray-100 text-gray-800"}`}
                >
                  {t(`status.${event.status.toLowerCase()}`)}
                </span>
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">
                  {t(`category.${event.category.toLowerCase()}`)}
                </span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white">
                  {t(`visibility.${event.visibility.toLowerCase()}`)}
                </span>
              </div>
              <h1 className="text-2xl font-bold md:text-3xl">{event.title}</h1>
            </div>
          </div>
        ) : (
          <div className="relative h-48 bg-linear-to-br from-orange-400 to-orange-600">
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="h-20 w-20 text-white/30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="absolute right-0 bottom-0 left-0 p-6 text-white">
              <div className="mb-3 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[event.status] || "bg-gray-100 text-gray-800"}`}
                >
                  {t(`status.${event.status.toLowerCase()}`)}
                </span>
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">
                  {t(`category.${event.category.toLowerCase()}`)}
                </span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white">
                  {t(`visibility.${event.visibility.toLowerCase()}`)}
                </span>
              </div>
              <h1 className="text-2xl font-bold md:text-3xl">{event.title}</h1>
            </div>
          </div>
        )}

        {/* Action Bar */}
        {canManageEvents && (
          <div className="flex flex-wrap gap-3 border-t border-gray-100 px-6 py-4">
            <Link
              href={`/events/${event.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              {t("actions.edit")}
            </Link>

            {/* REQ-022 (E4-S1): manage paid-registration fee categories */}
            <Link
              href={`/events/${event.id}/fees`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {t("fees.manageFees")}
            </Link>

            {event.status === "Draft" && (
              <button
                onClick={handlePublish}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {t("actions.publish")}
              </button>
            )}

            {event.status === "Published" && (
              <>
                <button
                  onClick={handleUnpublish}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {t("actions.unpublish")}
                </button>
                <button
                  onClick={() => setShowCancelDialog(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  {t("actions.cancel")}
                </button>
              </>
            )}

            {canDeleteEvents && (
              <button
                onClick={() => setShowDeleteDialog(true)}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                {t("actions.delete")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column - Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t("detail.description")}
            </h2>
            <div className="prose prose-sm max-w-none text-gray-600">
              {event.description.split("\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Cancellation Reason */}
          {event.status === "Cancelled" && event.cancellationReason && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <h2 className="mb-2 text-lg font-semibold text-red-800">
                {t("detail.cancellationReason")}
              </h2>
              <p className="text-red-700">{event.cancellationReason}</p>
            </div>
          )}

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {t("form.tags")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Info Cards */}
        <div className="space-y-6">
          {/* Date & Time */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2">
                <svg
                  className="h-5 w-5 text-orange-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("detail.dateTime")}
              </h2>
            </div>
            <p className="text-gray-600">{formatEventDate(event, "de")}</p>
            {event.isAllDay && (
              <span className="mt-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                {t("form.allDayEvent")}
              </span>
            )}
          </div>

          {/* Location */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2">
                <svg
                  className="h-5 w-5 text-orange-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("detail.location")}
              </h2>
            </div>
            <p className="font-medium text-gray-900">{event.location}</p>
            {event.locationAddress && (
              <p className="mt-1 text-sm text-gray-600">
                {event.locationAddress}
              </p>
            )}
            {event.locationUrl && (
              <a
                href={event.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
              >
                {t("detail.viewOnMap")}
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>

          {/* Cost */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2">
                <svg
                  className="h-5 w-5 text-orange-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("detail.cost")}
              </h2>
            </div>
            {event.isFree ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                {t("detail.freeEvent")}
              </span>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">
                  CHF {event.cost?.toFixed(2)}
                </p>
                {event.costDescription && (
                  <p className="mt-1 text-sm text-gray-600">
                    {event.costDescription}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Registration */}
          {event.registrationRequired && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-orange-100 p-2">
                  <svg
                    className="h-5 w-5 text-orange-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {t("registration.title")}
                </h2>
              </div>
              <div className="space-y-2 text-sm">
                {event.maxParticipants && (
                  <p className="text-gray-600">
                    {t("registration.maxParticipants")}:{" "}
                    <span className="font-medium text-gray-900">
                      {event.maxParticipants}
                    </span>
                  </p>
                )}
                {event.registrationDeadline && (
                  <p className="text-gray-600">
                    {t("registration.deadline")}:{" "}
                    <span className="font-medium text-gray-900">
                      {new Date(event.registrationDeadline).toLocaleDateString(
                        "de-CH",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                  </p>
                )}
                {event.waitlistEnabled && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                    {t("registration.waitlistEnabled")}
                  </span>
                )}
                {event.isRegistrationOpen ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                    {t("registration.open")}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                    {t("registration.closed")}
                  </span>
                )}
              </div>

              {/* Member registration section */}
              <div className="mt-4 border-t border-gray-100 pt-4">
                {myRegLoading ? (
                  <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
                ) : regSuccess ? (
                  <div
                    className={`rounded-lg p-3 ${regSuccess.isWaitlisted ? "border border-yellow-200 bg-yellow-50" : "border border-green-200 bg-green-50"}`}
                  >
                    <p
                      className={`text-sm font-medium ${regSuccess.isWaitlisted ? "text-yellow-800" : "text-green-800"}`}
                    >
                      {regSuccess.isWaitlisted
                        ? t("registration.waitlistSuccess", {
                            position: regSuccess.waitlistPosition ?? 0,
                          })
                        : t("registration.successMessage")}
                    </p>
                  </div>
                ) : myRegistration ? (
                  <div className="space-y-3">
                    <div
                      className={`rounded-lg p-3 ${myRegistration.isWaitlisted ? "border border-yellow-200 bg-yellow-50" : "border border-green-200 bg-green-50"}`}
                    >
                      <p
                        className={`text-sm font-medium ${myRegistration.isWaitlisted ? "text-yellow-800" : "text-green-800"}`}
                      >
                        {myRegistration.isWaitlisted
                          ? t("registration.waitlistPositionShort", {
                              position: myRegistration.waitlistPosition ?? 0,
                            })
                          : t("registration.registered")}
                      </p>
                      {myRegistration.numberOfGuests > 0 && (
                        <p className="mt-1 text-xs text-gray-600">
                          {t("registration.guestCount")}:{" "}
                          {myRegistration.numberOfGuests}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setShowCancelRegDialog(true)}
                      className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
                    >
                      {t("registration.cancelRegistration")}
                    </button>
                  </div>
                ) : event.isRegistrationOpen ? (
                  showRegForm ? (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          {t("registration.guestCount")}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={regNumberOfGuests}
                          onChange={(e) =>
                            setRegNumberOfGuests(
                              Math.max(0, parseInt(e.target.value) || 0)
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          {t("registration.specialRequirementsOptional")}
                        </label>
                        <textarea
                          value={regSpecialRequirements}
                          onChange={(e) =>
                            setRegSpecialRequirements(e.target.value)
                          }
                          placeholder={t(
                            "registration.specialRequirementsPlaceholder"
                          )}
                          rows={2}
                          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleRegister}
                          disabled={regSubmitting}
                          className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                        >
                          {regSubmitting
                            ? tCommon("loading")
                            : t("registration.register")}
                        </button>
                        <button
                          onClick={() => setShowRegForm(false)}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          {tCommon("back")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowRegForm(true)}
                      className="w-full rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
                    >
                      {t("registration.registerNow")}
                    </button>
                  )
                ) : (
                  <p className="text-sm text-gray-500">
                    {t("registration.notPossible")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Contact */}
          {(event.organizerName ||
            event.contactEmail ||
            event.contactPhone) && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-orange-100 p-2">
                  <svg
                    className="h-5 w-5 text-orange-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {t("detail.contact")}
                </h2>
              </div>
              <div className="space-y-2 text-sm">
                {event.organizerName && (
                  <p className="font-medium text-gray-900">
                    {event.organizerName}
                  </p>
                )}
                {event.contactEmail && (
                  <a
                    href={`mailto:${event.contactEmail}`}
                    className="flex items-center gap-2 text-orange-600 hover:text-orange-700"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    {event.contactEmail}
                  </a>
                )}
                {event.contactPhone && (
                  <a
                    href={`tel:${event.contactPhone}`}
                    className="flex items-center gap-2 text-orange-600 hover:text-orange-700"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    {event.contactPhone}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* REQ-021: Registrations & Waitlist Management Panel */}
      {canManageEvents && event.registrationRequired && (
        <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2">
                <svg
                  className="h-5 w-5 text-orange-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("registration.registrationsOverview")}
              </h2>
            </div>
            <Link
              href={`/events/${event.id}/registrations`}
              className="text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              {t("registration.showAllRegistrations")}
            </Link>
          </div>

          {/* Statistics Summary */}
          {regStats && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {regStats.totalRegistrations}
                </p>
                <p className="text-xs text-gray-500">
                  {t("registration.total")}
                </p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">
                  {regStats.confirmedCount}
                </p>
                <p className="text-xs text-green-600">
                  {t("registration.confirmed")}
                </p>
              </div>
              <div className="rounded-lg bg-yellow-50 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">
                  {regStats.waitlistedCount}
                </p>
                <p className="text-xs text-yellow-600">
                  {t("registration.waitlisted")}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">
                  {regStats.checkedInCount}
                </p>
                <p className="text-xs text-blue-600">
                  {t("registration.checkedIn")}
                </p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">
                  {regStats.cancelledCount}
                </p>
                <p className="text-xs text-red-600">
                  {t("registration.cancelledShort")}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-2xl font-bold text-gray-700">
                  {regStats.noShowCount}
                </p>
                <p className="text-xs text-gray-500">
                  {t("registration.noShow")}
                </p>
              </div>
            </div>
          )}

          {/* Waitlist Section */}
          {event.waitlistEnabled && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                  {t("registration.waitlistManagement")}
                </h3>
                {waitlistEntries.length > 0 && (
                  <button
                    onClick={handlePromoteFromWaitlist}
                    disabled={promoteLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 10l7-7m0 0l7 7m-7-7v18"
                      />
                    </svg>
                    {promoteLoading
                      ? tCommon("loading")
                      : t("registration.promoteNext")}
                  </button>
                )}
              </div>

              {waitlistLoading ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-gray-100" />
                  ))}
                </div>
              ) : waitlistEntries.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">
                  {t("registration.waitlistEmpty")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          {t("registration.position")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          {t("registration.participant")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          {t("registration.email")}
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">
                          {t("registration.guests")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          {t("registration.registeredAt")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {waitlistEntries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="px-3 py-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100 text-xs font-bold text-yellow-800">
                              {entry.waitlistPosition ?? "-"}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {entry.participantName}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {entry.participantEmail}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {entry.numberOfGuests}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {new Date(entry.registeredAt).toLocaleDateString(
                              "de-CH",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              {t("actions.cancelEvent")}
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              {t("actions.confirmCancelDesc")}
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("form.cancelReason")}
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t("form.cancelReasonPlaceholder")}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancelReason("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {tCommon("back")}
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? tCommon("loading") : t("actions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              {t("actions.deleteEvent")}
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              {t("actions.confirmDeleteDesc")}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {tCommon("back")}
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? tCommon("loading") : t("actions.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Registration Dialog */}
      {showCancelRegDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              {t("registration.cancelRegistration")}
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              {t("registration.confirmCancelDescription")}
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("registration.cancelReason")}
              </label>
              <textarea
                value={cancelRegReason}
                onChange={(e) => setCancelRegReason(e.target.value)}
                placeholder={t("registration.cancelReasonPlaceholder")}
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelRegDialog(false);
                  setCancelRegReason("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {tCommon("back")}
              </button>
              <button
                onClick={handleCancelMyRegistration}
                disabled={cancellingReg}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {cancellingReg ? tCommon("loading") : t("registration.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQ-024 (E3.S4): member self-signup volunteer-shift section */}
      <VolunteerSelfSignupSection
        eventId={id}
        eventCancelled={event.status === "Cancelled"}
      />
    </PageShell>
  );
}

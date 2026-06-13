// SPDX-License-Identifier: AGPL-3.0-or-later
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import Image from "next/image";
import {
  getPublicEvent,
  getPublicEventFeeCategories,
} from "../api/public-content-api";
import { EventRegistrationForm } from "./event-registration-form";
import type { PublicEventDto, PublicFeeCategory } from "../types/public.types";

/**
 * E28-S2: public event DETAIL as an async Server Component (DEC-4=A). Reads
 * `params.id` (passed by the route entry), fetches the event + (best-effort) fee
 * categories at request time, and server-renders the read-only display (image,
 * badges, details grid, description). The stateful registration block is the
 * `<EventRegistrationForm>` client island — the fee section stays mounted through
 * this page so the REQ-022 fee test stays green. The missing/unpublished path keeps
 * the GENERIC error block with the raw error string (no `notFound()` — A56/AC-3).
 * A79 delta: no client loading spinner (RSC awaits the fetch).
 */
export default async function EventDetail({ id }: { id: string }) {
  const t = await getTranslations("publicEvents");

  let event: PublicEventDto | null = null;
  let error: string | null = null;
  let feeCategories: PublicFeeCategory[] = [];
  try {
    event = await getPublicEvent(id);
    feeCategories = await getPublicEventFeeCategories(id);
  } catch (err) {
    error = err instanceof Error ? err.message : t("fetchError");
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-CH", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (error || !event) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-medium text-red-700">{t("errorTitle")}</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <Link
            href="/public/events"
            className="mt-4 inline-block text-sm font-medium text-[#EA580C] hover:underline"
          >
            &larr; {t("backToEvents")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/public/events"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-[#EA580C] hover:underline"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          {t("backToEvents")}
        </Link>

        {/* Main card */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {/* Image / Hero */}
          <div className="relative h-64 bg-linear-to-br from-[#EA580C] to-orange-400 sm:h-72">
            {event.imageUrl ? (
              <Image
                src={event.imageUrl}
                alt={event.imageAltText ?? event.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <svg
                  className="h-20 w-20 text-white/30"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8">
            {/* Badges */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {event.category && (
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">
                  {event.category}
                </span>
              )}
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  event.isFree
                    ? "bg-green-100 text-green-800"
                    : "bg-orange-100 text-orange-800"
                }`}
              >
                {event.isFree
                  ? t("free")
                  : event.cost
                    ? `CHF ${event.cost}`
                    : t("paid")}
              </span>
              {event.hasEnded && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                  {t("eventEnded")}
                </span>
              )}
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              {event.title}
            </h1>

            {/* Event ended notice */}
            {event.hasEnded && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-gray-600">
                {t("eventEndedNotice")}
              </div>
            )}

            {/* Details grid */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {/* Date & Time */}
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#EA580C]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t("dateTime")}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatDateTime(event.startDate)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t("until")} {formatDateTime(event.endDate)}
                  </p>
                  {event.isAllDay && (
                    <p className="text-xs text-gray-400">{t("allDay")}</p>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#EA580C]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t("location")}
                  </p>
                  <p className="text-sm text-gray-600">{event.location}</p>
                  {event.locationAddress && (
                    <p className="text-sm text-gray-500">
                      {event.locationAddress}
                    </p>
                  )}
                  {event.locationUrl && (
                    <a
                      href={event.locationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#EA580C] hover:underline"
                    >
                      {t("viewMap")}
                    </a>
                  )}
                </div>
              </div>

              {/* Cost */}
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#EA580C]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t("costLabel")}
                  </p>
                  <p className="text-sm text-gray-600">
                    {event.isFree
                      ? t("free")
                      : event.cost
                        ? `CHF ${event.cost}`
                        : t("paid")}
                  </p>
                  {event.costDescription && (
                    <p className="text-sm text-gray-500">
                      {event.costDescription}
                    </p>
                  )}
                </div>
              </div>

              {/* Organizer / Contact */}
              {(event.organizerName || event.contactEmail) && (
                <div className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#EA580C]"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {t("organizer")}
                    </p>
                    {event.organizerName && (
                      <p className="text-sm text-gray-600">
                        {event.organizerName}
                      </p>
                    )}
                    {event.contactEmail && (
                      <a
                        href={`mailto:${event.contactEmail}`}
                        className="text-sm text-[#EA580C] hover:underline"
                      >
                        {event.contactEmail}
                      </a>
                    )}
                    {event.contactPhone && (
                      <p className="text-sm text-gray-500">
                        {event.contactPhone}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("description")}
              </h2>
              <div className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
                {event.description}
              </div>
            </div>

            {/* Registration section (client island — manual state preserved) */}
            {event.registrationRequired && !event.hasEnded && (
              <EventRegistrationForm
                event={event}
                feeCategories={feeCategories}
                eventId={id}
              />
            )}

            {/* Registration deadline */}
            {event.registrationDeadline && !event.hasEnded && (
              <p className="mt-4 text-xs text-gray-400">
                {t("registrationDeadline")}:{" "}
                {new Date(event.registrationDeadline).toLocaleDateString(
                  "de-CH",
                  {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

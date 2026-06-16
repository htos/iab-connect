"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import type { PublicEventDto } from "../types/public.types";

/**
 * E28-S2: the events-list client island (DEC-4=A). Owns the 2-field search +
 * category `<select>` (categories derived from the server-fetched events), plus
 * the content area (error / empty / card grid). The events are passed in from the
 * Server Component so the initial card list is SSR'd (SEO/SSR improvement).
 * Behaviour-preserving vs `events/page.tsx`: de-CH date-with-time, free/CHF/paid
 * badge, content-language badge, `hasEnded → ended` chip, `imageAltText ?? title`
 * + placeholder-SVG fallback, the error title + raw error string.
 */
export function EventsFilter({
  events,
  error,
}: {
  events: PublicEventDto[];
  error: string | null;
}) {
  const t = useTranslations("publicEvents");
  const tLang = useTranslations("language");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(events.map((e) => e.category).filter(Boolean))),
    [events]
  );

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        !search ||
        event.title.toLowerCase().includes(search.toLowerCase()) ||
        event.location.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        !categoryFilter || event.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [events, search, categoryFilter]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      {/* Search & Filter */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
          >
            <option value="">{t("allCategories")}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <p className="font-medium">{t("errorTitle")}</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {!error && filteredEvents.length === 0 && (
          <div className="py-20 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-300"
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
            <p className="mt-4 text-lg font-medium text-gray-600">
              {t("noEvents")}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {t("noEventsSubtitle")}
            </p>
          </div>
        )}

        {!error && filteredEvents.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => (
              <Link
                key={event.id}
                href={`/public/events/${event.id}`}
                className="group overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Image placeholder */}
                <div className="relative h-48 bg-linear-to-br from-[#EA580C] to-orange-400">
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
                        className="h-16 w-16 text-white/40"
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
                  {/* Category badge */}
                  {event.category && (
                    <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-800">
                      {event.category}
                    </span>
                  )}
                  {/* REQ-055 (E7-S4): content-language badge (only when set) */}
                  {event.contentLanguage && (
                    <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700">
                      {tLang(event.contentLanguage)}
                    </span>
                  )}
                  {/* Free/cost badge */}
                  <span
                    className={`absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-medium ${
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
                </div>

                {/* Card body */}
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#EA580C]">
                    {event.title}
                  </h3>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <svg
                      className="h-4 w-4"
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
                    <span>{formatDate(event.startDate)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                    <svg
                      className="h-4 w-4"
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
                    <span>{event.location}</span>
                  </div>
                  {event.shortDescription && (
                    <p className="mt-3 line-clamp-2 text-sm text-gray-600">
                      {event.shortDescription}
                    </p>
                  )}
                  {event.hasEnded && (
                    <span className="mt-3 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                      {t("ended")}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

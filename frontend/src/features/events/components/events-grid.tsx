import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { EventDto } from "../types/events.types";
import { eventStatusColor } from "./event-status-badge";
import { formatEventDate } from "./format-event-date";

interface EventsGridProps {
  events: EventDto[];
}

// Grid (card) view. Markup, brand classes and i18n keys preserved verbatim from
// the god-page. The corner status badge composes the shared `eventStatusColor`
// helper to keep its exact `absolute top-2 right-2 ... rounded-full` classes.
export function EventsGrid({ events }: EventsGridProps) {
  const t = useTranslations("events");

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <Link
          key={event.id}
          href={`/events/${event.id}`}
          className="group overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
        >
          {/* Event Image */}
          <div className="relative aspect-video bg-linear-to-br from-orange-100 to-orange-200">
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
                <svg
                  className="h-12 w-12 text-orange-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
            {/* Status Badge */}
            <span
              className={`absolute top-2 right-2 rounded-full px-2 py-1 text-xs font-medium ${eventStatusColor(event.status)}`}
            >
              {t(`status.${event.status.toLowerCase()}`)}
            </span>
          </div>

          {/* Event Content */}
          <div className="p-4">
            <h3 className="line-clamp-1 font-semibold text-gray-900 transition-colors group-hover:text-orange-600">
              {event.title}
            </h3>

            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <svg
                className="h-4 w-4 shrink-0"
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
              <span className="line-clamp-1">
                {formatEventDate(event, "de")}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <svg
                className="h-4 w-4 shrink-0"
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
              <span className="line-clamp-1">{event.location}</span>
            </div>

            {/* Tags */}
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                {t(`category.${event.category.toLowerCase()}`)}
              </span>
              {event.isFree && (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  {t("detail.freeEvent")}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

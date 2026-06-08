import { useTranslations } from "next-intl";
import type { EventDto } from "../types/events.types";
import { eventStatusColor } from "./event-status-badge";
import { formatEventDate } from "./format-event-date";

interface EventsTableProps {
  events: EventDto[];
  // Row click navigates to the event detail (god-page used router.push).
  onRowClick: (id: string) => void;
}

// List (table) view. Markup, brand classes and i18n keys preserved verbatim from
// the god-page. The status badge composes the shared `eventStatusColor` helper to
// keep its exact `inline-flex items-center px-2 py-0.5 ... rounded-full` classes.
export function EventsTable({ events, onRowClick }: EventsTableProps) {
  const t = useTranslations("events");

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("form.title")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("detail.dateTime")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("detail.location")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("filterByCategory")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
              {t("filterByStatus")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {events.map((event) => (
            <tr
              key={event.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => onRowClick(event.id)}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-medium text-gray-900">{event.title}</div>
                {event.shortDescription && (
                  <div className="line-clamp-1 text-sm text-gray-500">
                    {event.shortDescription}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                {formatEventDate(event, "de")}
              </td>
              <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                {event.location}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                  {t(`category.${event.category.toLowerCase()}`)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${eventStatusColor(event.status)}`}
                >
                  {t(`status.${event.status.toLowerCase()}`)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

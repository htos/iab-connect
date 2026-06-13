import { useTranslations } from "next-intl";
import type { EventStatus } from "../types/events.types";

// E24-S2: status colours preserved as the god-page's raw Tailwind map (NOT the
// semantic Badge primitive) — the de-CH event status palette and the E24-S1
// characterization assertions both pin these exact classes. Centralised here so
// the list (grid + list view) and detail components share one source.
export const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-800",
  Published: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
  Completed: "bg-blue-100 text-blue-800",
};

export function eventStatusColor(status: string): string {
  return statusColors[status] ?? "bg-gray-100 text-gray-800";
}

/**
 * Default inline status badge (the list "list-view" + detail layout). Call sites
 * that need different positioning (e.g. the grid card's absolute corner badge)
 * compose the `eventStatusColor` helper directly to keep their exact classes.
 */
export function EventStatusBadge({
  status,
  className = "",
}: {
  status: EventStatus | string;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${eventStatusColor(status)} ${className}`.trim()}
    >
      {t(`status.${String(status).toLowerCase()}`)}
    </span>
  );
}

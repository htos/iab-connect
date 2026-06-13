import type { EventDto } from "../types/events.types";

// Date/time formatter preserved verbatim from the Events list god-page. The list
// always calls this with locale "de" (the de-CH presentation locale); kept as a
// parameter to match the god-page signature exactly.
export function formatEventDate(event: EventDto, locale: string): string {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const localeCode = locale === "de" ? "de-CH" : "en-US";
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
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

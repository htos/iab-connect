// Zurich↔UTC datetime helpers for the fee-category availability window (E24-S3).
// Copied VERBATIM from the events fees god-page so the DST-correct round-trip is
// behaviour-identical (A79). Kept slice-local (not promoted to a shared util) per
// the story scope — only the fees sub-page uses them today.
//
// `availableFrom`/`availableUntil` are stored as ISO-UTC on the wire but edited
// in Europe/Zurich wall-clock time via `<input type="datetime-local">`. The
// Intl-offset approach avoids the slice-the-Z offset bug.

const ZURICH_TIME_ZONE = "Europe/Zurich";

/** Render an ISO-UTC instant in Zurich wall-clock time (de-CH) for the table. */
export function formatZurich(isoUtc: string): string {
  return new Date(isoUtc).toLocaleString("de-CH", {
    timeZone: ZURICH_TIME_ZONE,
  });
}

/**
 * Convert an ISO-UTC string to the `yyyy-MM-ddTHH:mm` form expected by
 * `<input type="datetime-local">`, rendered in Europe/Zurich wall-clock time.
 */
export function utcIsoToZurichLocalInput(isoUtc: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZURICH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoUtc));
  const lookup = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${lookup("year")}-${lookup("month")}-${lookup("day")}T${lookup("hour")}:${lookup("minute")}`;
}

/**
 * Convert a `<input type="datetime-local">` value (entered in Europe/Zurich
 * wall-clock time) into an ISO-UTC string for the API, DST-correct via the Intl
 * offset.
 */
export function zurichLocalInputToUtcIso(localInput: string): string {
  if (!localInput) return "";
  const asUtc = new Date(`${localInput}:00.000Z`);
  if (Number.isNaN(asUtc.getTime())) return "";
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZURICH_TIME_ZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(asUtc);
  const offsetLabel =
    tzParts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(offsetLabel);
  const sign = match?.[1] === "-" ? -1 : 1;
  const hours = match ? parseInt(match[2], 10) : 0;
  const minutes = match?.[3] ? parseInt(match[3], 10) : 0;
  const offsetMinutes = sign * (hours * 60 + minutes);
  return new Date(asUtc.getTime() - offsetMinutes * 60_000).toISOString();
}

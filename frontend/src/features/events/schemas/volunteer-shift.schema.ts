import { z } from "zod";
import type { useTranslations } from "next-intl";

/**
 * Volunteer shift form schema + Zurich↔UTC time helpers (E24-S3).
 *
 * Lifted VERBATIM from the volunteers god-page (REQ-024, E3.S4). The schema is
 * built per-render with the `next-intl` translator so every validation message
 * is localized; the `endAfterStart` refinement attaches its error to `endsAt`.
 *
 * The Zurich↔UTC conversion is the regression-critical piece (E24-S1 oracle):
 * backend stores shift times as UTC; the staff form, table view, and reminder
 * email all display in Europe/Zurich wall-clock time. `formatToParts` (not
 * `Date.parse`) keeps it DST-correct on transition days.
 */
export const ZURICH_TIME_ZONE = "Europe/Zurich";

export const SHIFT_TITLE_MAX = 200;
export const SHIFT_TEXT_MAX = 1000;

export function formatZurich(isoUtc: string): string {
  return new Date(isoUtc).toLocaleString("de-CH", {
    timeZone: ZURICH_TIME_ZONE,
  });
}

/**
 * Convert an ISO-UTC string to the `yyyy-MM-ddTHH:mm` form expected by
 * `<input type="datetime-local">`, rendered in Europe/Zurich wall-clock time.
 * (Review H-S4-3: a naive `iso.slice(0, 16)` would keep the UTC value but strip
 * the `Z`, so the browser would interpret it as local time and silently shift.)
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
 * Convert a `<input type="datetime-local">` value (entered by the user in
 * Europe/Zurich wall-clock time) into an ISO-UTC string for the API. We compute
 * the UTC offset for the chosen instant once, then subtract it so the resulting
 * Date represents the correct UTC moment. Uses `formatToParts` instead of
 * `Date.parse` to stay DST-correct on transition days (review H-S4-3).
 */
export function zurichLocalInputToUtcIso(localInput: string): string {
  if (!localInput) return "";
  // Step 1: parse the user's wall-clock value as if it were UTC. This is
  // intentionally wrong — we use the result to ask the Intl API what the offset
  // would be for that local instant.
  const asUtc = new Date(`${localInput}:00.000Z`);
  if (Number.isNaN(asUtc.getTime())) return "";
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZURICH_TIME_ZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(asUtc);
  const offsetLabel =
    tzParts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  // shortOffset returns "GMT+1", "GMT+2", "GMT-3" etc. for hour-offset zones.
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(offsetLabel);
  const sign = match?.[1] === "-" ? -1 : 1;
  const hours = match ? parseInt(match[2], 10) : 0;
  const minutes = match?.[3] ? parseInt(match[3], 10) : 0;
  const offsetMinutes = sign * (hours * 60 + minutes);
  // Step 2: subtract the offset to land on the correct UTC instant.
  return new Date(asUtc.getTime() - offsetMinutes * 60_000).toISOString();
}

export type ShiftFormValues = {
  roleId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  allowWaitlist: boolean;
  allowSelfSignup: boolean;
  notes: string;
};

/**
 * Per-render zod schema for the shift form, localized via the `next-intl`
 * translator. The `endAfterStart` refinement attaches its error to `endsAt`.
 */
export function buildShiftSchema(t: ReturnType<typeof useTranslations>) {
  return z
    .object({
      roleId: z.string().min(1, t("validation.roleRequired")),
      title: z
        .string()
        .trim()
        .min(1, t("validation.titleRequired"))
        .max(SHIFT_TITLE_MAX, t("validation.titleTooLong")),
      description: z
        .string()
        .max(SHIFT_TEXT_MAX, t("validation.descriptionTooLong")),
      startsAt: z.string().min(1, t("validation.startRequired")),
      endsAt: z.string().min(1, t("validation.endRequired")),
      capacity: z.number().int().min(1, t("validation.capacityMin")),
      allowWaitlist: z.boolean(),
      allowSelfSignup: z.boolean(),
      notes: z.string().max(SHIFT_TEXT_MAX, t("validation.notesTooLong")),
    })
    .refine(
      (v) =>
        !v.startsAt || !v.endsAt || new Date(v.startsAt) < new Date(v.endsAt),
      { message: t("validation.endAfterStart"), path: ["endsAt"] }
    );
}

import { z } from "zod";
import { EventCategory, EventVisibility } from "../types/events.types";

/**
 * Event new/edit form schema — applies the E22 RHF+Zod form sub-recipe to the
 * Events feature (E24-S2). Behaviour-preserving (A79): `required` mirrors the
 * god-pages' HTML5 `required` attributes — title, description, location,
 * startDate, endDate. Everything else stays optional (the god-page never
 * validated them client-side); no new `.email()`/`.url()` constraints are
 * introduced. The required message is a next-intl key rendered via
 * `t(errors.x.message)`.
 *
 * Field-shape notes (preserving god-page behaviour):
 * - `isAllDay`/`registrationRequired`/`waitlistEnabled` are booleans (checkboxes).
 * - `maxParticipants`/`cost` are optional numbers (the god-page parses to
 *   `parseFloat(value) || undefined` and renders `value || ''`).
 * - `tags` is a `string[]` (the comma-split input is parsed into the array; the
 *   raw comma input string is component-local UI state, not part of the model).
 * - `startDate`/`endDate`/`registrationDeadline` are the raw input strings
 *   (`datetime-local`/`date`); the ISO-UTC conversion + `registrationDeadline`
 *   omission-when-blank happens at submit (component/mutation), NOT here.
 * - `category`/`visibility` are the canonical enums (always a valid value;
 *   defaulted by the form).
 */
export const eventFormSchema = z.object({
  title: z.string().trim().min(1, "form.required"),
  description: z.string().trim().min(1, "form.required"),
  location: z.string().trim().min(1, "form.required"),
  startDate: z.string().trim().min(1, "form.required"),
  endDate: z.string().trim().min(1, "form.required"),
  shortDescription: z.string(),
  locationAddress: z.string(),
  locationUrl: z.string(),
  isAllDay: z.boolean(),
  timeZone: z.string(),
  maxParticipants: z.number().optional(),
  registrationRequired: z.boolean(),
  registrationDeadline: z.string(),
  waitlistEnabled: z.boolean(),
  visibility: z.nativeEnum(EventVisibility),
  category: z.nativeEnum(EventCategory),
  tags: z.array(z.string()),
  imageUrl: z.string(),
  imageAltText: z.string(),
  organizerName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  cost: z.number().optional(),
  costDescription: z.string(),
  contentLanguage: z.string(),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;

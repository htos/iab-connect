import { z } from "zod";

/**
 * Form sub-recipe (E22-S3, reused by E29-S4 DEC-2 = A) — the profile edit form's
 * Zod schema.
 *
 * Behaviour-preserving (A79): the required fields mirror the original HTML5
 * `required` attributes on the god-page edit form — `firstName` / `lastName` /
 * `street` / `postalCode` / `city`. `phone` and `country` stay OPTIONAL plain
 * strings (the god-page applied no format validation beyond the native input
 * `type`, so adding strict checks here would reject values the previous form
 * accepted — a behaviour change). The required message is a next-intl key,
 * rendered via `t(errors.x.message)`. The field set maps 1:1 onto
 * `UpdateOwnProfileRequest` (PUT body byte-identical — the raw input is sent
 * UNTRIMMED, matching the god-page's HTML5-`required` form which never trimmed
 * before the PUT; `.min(1)` keeps the required gate without transforming the
 * value).
 */
export const profileFormSchema = z.object({
  firstName: z.string().min(1, "form.required"),
  lastName: z.string().min(1, "form.required"),
  street: z.string().min(1, "form.required"),
  postalCode: z.string().min(1, "form.required"),
  city: z.string().min(1, "form.required"),
  phone: z.string(),
  country: z.string(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

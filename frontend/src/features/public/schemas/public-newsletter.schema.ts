// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

/**
 * E28-S3: Zod schema for the public newsletter subscribe form (E22 form sub-recipe).
 *
 * Behaviour-preserving (A96): `email` required via `z.string().min(1,"form.required")`
 * (no `.email()` — the god-form did no format validation); `firstName`/`lastName`
 * are optional BARE `z.string()` (default `""`). The load-bearing `|| undefined`
 * coercion that keeps empty names OUT of the request body is applied at the CALL
 * SITE (not in the schema), so an empty `firstName:""` from RHF still becomes
 * `undefined` in the `subscribeNewsletter(email, firstName, lastName)` call.
 */
export const publicNewsletterSchema = z.object({
  email: z.string().min(1, "form.required"),
  firstName: z.string(),
  lastName: z.string(),
});

export type PublicNewsletterValues = z.infer<typeof publicNewsletterSchema>;

/** Unsubscribe-by-email is a single required field (the unsubscribe tab). */
export const publicUnsubscribeEmailSchema = z.object({
  email: z.string().min(1, "form.required"),
});

export type PublicUnsubscribeEmailValues = z.infer<
  typeof publicUnsubscribeEmailSchema
>;

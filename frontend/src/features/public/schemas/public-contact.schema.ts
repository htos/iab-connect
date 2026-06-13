// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

/**
 * E28-S3: Zod schema for the public contact form (E22 form sub-recipe).
 *
 * Behaviour-preserving (A79/A95/A96): the god-form applied ZERO format validation
 * beyond the native input `type`, so there is NO `.email()`/`.url()` here — adding
 * them would reject values the old form accepted. Required fields use
 * `z.string().min(1, "form.required")` (the deliberate A79 delta: whitespace-only is
 * now blocked where HTML5 `required` let a single space through). `subject` is
 * `z.string().min(1)` NOT `z.enum(subset)` so the empty `""` placeholder default
 * validates as "required" while the 6 option values stay byte-identical (A95).
 * `website` is the honeypot — a BARE `z.string()` (NO `.trim()`, A96): it must stay
 * in the payload and its raw value drives the silent-success short-circuit.
 */
export const publicContactSchema = z.object({
  name: z.string().min(1, "form.required"),
  email: z.string().min(1, "form.required"),
  subject: z.string().min(1, "form.required"),
  message: z.string().min(1, "form.required"),
  website: z.string(),
});

export type PublicContactValues = z.infer<typeof publicContactSchema>;

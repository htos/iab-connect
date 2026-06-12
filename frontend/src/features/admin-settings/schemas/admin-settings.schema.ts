import { z } from "zod";

/**
 * Branding settings form schema (E27-S3, DEC-2 = RHF+Zod form sub-recipe).
 *
 * Behaviour-preserving (A79) — ported VERBATIM from the god-page's hand-rolled
 * validation:
 *   - `primaryColor` accepts a 3/6/8-digit hex (the god-page `hexPattern`), but
 *     ONLY when non-blank — a blank value is valid (saved as null, "not
 *     configured"). Same for `contactEmail` (the god-page `emailPattern`).
 *   - The other fields (applicationName, logoText, the two logo colours, the
 *     description / phone / address, publicSiteEnabled) carry NO validation, exactly
 *     like the god-page.
 *
 * A96 — NO `.trim()`/transform on any submitted-byte field: the god-page validated
 * a `.trim()`ed COPY for the regex check but sent the trimmed-or-null value on save;
 * the trim→null mapping is done at the call site (`toUpdateRequest`) so the schema
 * never mutates the user's bytes. The error messages are next-intl keys rendered via
 * `t(errors.x.message)` (`<form noValidate>` surfaces them per-field).
 */
const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const brandingSettingsSchema = z.object({
  applicationName: z.string(),
  logoText: z.string(),
  logoBackgroundColor: z.string(),
  logoTextColor: z.string(),
  description: z.string(),
  contactEmail: z
    .string()
    .refine((v) => v.trim() === "" || EMAIL_PATTERN.test(v.trim()), {
      message: "contactEmailInvalid",
    }),
  contactPhone: z.string(),
  contactAddress: z.string(),
  primaryColor: z
    .string()
    .refine((v) => v.trim() === "" || HEX_PATTERN.test(v.trim()), {
      message: "primaryColorInvalid",
    }),
  publicSiteEnabled: z.boolean(),
});

export type BrandingSettingsValues = z.infer<typeof brandingSettingsSchema>;

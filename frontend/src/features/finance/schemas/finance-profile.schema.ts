import { z } from "zod";

/**
 * Finance-profile form schema (E26-S6) — the E22 RHF+Zod sub-recipe applied to the big
 * ~17-field profile form. Behaviour-preserving (A79/A95/A96), it carries the program's
 * canonical A95 `countryCode` trap:
 *
 * - **A95 (load-bearing):** `countryCode` is a FULL `z.string()` union — NEVER
 *   `z.enum(EU_COUNTRIES)`. The `<select>` renders only 27 EU codes, but a CH↔EU history or
 *   a stale store can strand an OUT-OF-SET value (e.g. "GB"). The Zod field accepts whatever
 *   the form holds; the form keeps the RAW stored value in `defaultValues` + renders an
 *   out-of-set value as an extra `<option>`, so a no-touch edit-save round-trips it
 *   byte-identically. The same FULL-union treatment applies to `currency`/`jurisdiction`
 *   (the rendered subsets are CHF/EUR and CH/EU respectively).
 *
 * - **A96:** NO `.trim()` / transform on any submitted-byte field (org name/address/uid/iban/
 *   bic, …) — the god-page sends raw input. The `"" → null` mapping for optionals lives in the
 *   hook/content layer (a wire concern), NOT in the form values (which stay plain strings).
 *
 * - **DEC-2 = A (required-ness MATCHES the god-page enable-gate):** the profile save button is
 *   only `disabled={saving}` — there is NO required-field gate today (the `*` asterisks are
 *   decorative; the server validates). So the schema is PERMISSIVE: every field is a plain
 *   `z.string()`/`z.number()` and submit stays possible with empty inputs. Adding `.min(1)`
 *   here would reject inputs the god-page accepted (net red + behaviour change).
 */
export const financeProfileFormSchema = z.object({
  // A95: full transport unions (NOT z.enum of the rendered subset). Raw bytes round-trip.
  jurisdiction: z.string(),
  countryCode: z.string(),
  currency: z.string(),
  fiscalYearStartMonth: z.number(),
  // A96: no .trim() — raw bytes pass through as typed; required-ness matches the god-page
  // (permissive — no enable-gate today).
  organizationName: z.string(),
  organizationAddress: z.string(),
  organizationCity: z.string(),
  organizationPostalCode: z.string(),
  organizationCountry: z.string(),
  organizationEmail: z.string(),
  organizationPhone: z.string(),
  organizationWebsite: z.string(),
  organizationUid: z.string(),
  bankName: z.string(),
  bankIban: z.string(),
  bankBic: z.string(),
  accountingMode: z.string(),
});

export type FinanceProfileFormValues = z.infer<typeof financeProfileFormSchema>;

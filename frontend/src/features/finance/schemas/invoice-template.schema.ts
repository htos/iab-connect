import { z } from "zod";

/**
 * Invoice-template form schema (E26-S6) — E22 RHF+Zod sub-recipe. Behaviour-preserving
 * (A79/A95/A96/A98):
 *
 * - **A95:** `language` (en/de) + `jurisdiction` (CH/EU) are FULL `z.string()` unions, NEVER
 *   `z.enum(["en","de"])` / `z.enum(["CH","EU"])`. The stored value round-trips byte-identically
 *   (DEFAULT_FORM is `jurisdiction:"EU"`, `language:"en"`).
 *
 * - **A96:** NO `.trim()` on any submitted-byte field (name, notes, header/footer/legal). The
 *   `"" → null` optional mapping lives in the hook/content layer (a wire concern).
 *
 * - **DEC-2 = A (required-ness MATCHES the god-page enable-gate):** the save button is
 *   `disabled={saving || !form.name || !form.language}` → name + language are required. Use
 *   `.min(1)` (NOT `.trim()` — A96) so an empty name/language blocks submit exactly as the
 *   god-page's disabled-gate did. Everything else stays permissive.
 *
 * - **A98:** the mode-divergent surfaces (create-only `jurisdiction` <select>; edit-locked
 *   `countryCode` <input>) are threaded through the form via the `editing` prop — the schema
 *   itself is mode-agnostic; both modes are pinned by the S1 net.
 */
export const invoiceTemplateFormSchema = z.object({
  // A96: required via .min(1), no .trim().
  name: z.string().min(1, "form.required"),
  // A95: full transport unions.
  jurisdiction: z.string(),
  countryCode: z.string(),
  isDefault: z.boolean(),
  showVatId: z.boolean(),
  showTaxExemptionNote: z.boolean(),
  taxExemptionNote: z.string(),
  showReverseChargeNote: z.boolean(),
  reverseChargeNote: z.string(),
  showPaymentTerms: z.boolean(),
  defaultPaymentTerms: z.string(),
  showBankDetails: z.boolean(),
  logoUrl: z.string(),
  headerText: z.string(),
  footerText: z.string(),
  legalNotice: z.string(),
  // A95: full union (rendered subset is en/de). A96: required via .min(1).
  language: z.string().min(1, "form.required"),
});

export type InvoiceTemplateFormValues = z.infer<
  typeof invoiceTemplateFormSchema
>;

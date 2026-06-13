import { z } from "zod";

/**
 * Tax-code form schema (E26-S6) — E22 RHF+Zod sub-recipe. Behaviour-preserving (A79/A96):
 *
 * - **rate ×100/÷100 round-trip (load-bearing):** the FORM value is the human percentage
 *   (display ×100). The schema validates the percentage as a plain `z.number()`; the hook
 *   maps `rate/100` to the wire and `rate*100` from the stored fraction (the ÷100 must NOT
 *   be dropped). The schema deliberately does NOT carry the ÷100 — it is a wire concern owned
 *   by the hook so the form keeps the percentage the user sees/edits.
 *
 * - **A96:** NO `.trim()` on `code`/`label`.
 *
 * - **DEC-2 = A (required-ness MATCHES the god-page enable-gate):** the save button is
 *   `disabled={saving || !form.code || !form.label}` → code + label required via `.min(1)`
 *   (NOT `.trim()`). `rate` defaults to 0 (the god-page accepts 0); no min on rate.
 */
export const taxCodeFormSchema = z.object({
  // A96: required via .min(1), no .trim().
  code: z.string().min(1, "form.required"),
  label: z.string().min(1, "form.required"),
  // The human percentage (display ×100); the hook divides by 100 for the wire.
  rate: z.number(),
  isDefault: z.boolean(),
});

export type TaxCodeFormValues = z.infer<typeof taxCodeFormSchema>;

import { z } from "zod";

/**
 * Budget create/edit form schema (E26-S4 form sub-recipe, E22 RHF+Zod).
 *
 * Required-ness MATCHES the god-page enable-gate EXACTLY (do NOT add validation the
 * god-page lacks):
 *   `!!form.activityAreaId && !!form.fiscalPeriodId && amount.trim() !== "" &&
 *    !isNaN(parseFloat(amount)) && parseFloat(amount) >= 0`
 *
 * A95: area/period are FULL transport strings (`z.string()`, NEVER `z.enum`) — they are
 * disabled-on-edit so the raw stored value round-trips. `currency` is the closed CHF/EUR
 * set. A96: NO `.trim()` on the submitted `notes` bytes — only the enable-gate's own
 * `.min(1)` non-empty checks on the two selects (matching `!!form.x`). The amount refine
 * mirrors the god-page's parse-and-≥0 gate (the amount string itself is not trimmed before
 * submit — `parseFloat` ignores surrounding whitespace, matching the page).
 */
export const budgetFormSchema = z.object({
  activityAreaId: z.string().min(1, "form.required"),
  fiscalPeriodId: z.string().min(1, "form.required"),
  amount: z
    .string()
    .refine(
      (v) => v.trim() !== "" && !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
      "form.required"
    ),
  currency: z.enum(["CHF", "EUR"]),
  notes: z.string(),
});

export type BudgetFormSchemaValues = z.infer<typeof budgetFormSchema>;

// Transaction create/edit form schema (E26-S5) — the E22 RHF+Zod sub-recipe applied to
// the transactions god-page's create/edit modal.
//
// A96: the schema NEVER `.trim()`s a submitted field. The god-page's `handleSubmit`
//   trims description/reference/notes at PAYLOAD-build time (`form.description.trim()`,
//   `form.reference.trim() || null`, `form.notes.trim() || null`) — that EXACT trimming
//   is preserved in the form component's submit handler, NOT moved into validation
//   (so the rendered/edited bytes are untouched; only the outbound payload is trimmed,
//   byte-identical to the god-page).
// A95: `type` is the FULL transport union seeded from a closed lookup; account/category/
//   activityArea are `z.string()` (NEVER `z.enum(renderedSubset)`) so an out-of-set /
//   now-inactive stored value round-trips unchanged on edit.
// Required-ness MATCHES the god-page's effective enable-gate: description non-empty,
//   amount a number ≥ 0.01 (the input's `min="0.01"`/`required`), accountId + categoryId
//   chosen. date is required (the input is `required`, defaulted to today). reference/
//   notes/activityArea are optional. `<form noValidate>` surfaces per-field Zod errors.

import { z } from "zod";
import type { useTranslations } from "next-intl";

export function buildTransactionSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    date: z.string().min(1, t("required")),
    // A96 — no `.trim()`; required via `.min(1)` on the raw bytes.
    description: z.string().min(1, t("required")),
    // The amount input is a string in the form; ≥0.01 matches `min="0.01"`.
    amount: z
      .string()
      .min(1, t("required"))
      .refine((v) => {
        const n = parseFloat(v);
        return Number.isFinite(n) && n >= 0.01;
      }, t("required")),
    // A95 — FULL transport union; closed-set select.
    type: z.enum(["Income", "Expense"]),
    // A95 — `z.string()` (NOT an enum of the rendered options); raw value round-trips.
    accountId: z.string().min(1, t("required")),
    categoryId: z.string().min(1, t("required")),
    // Optional free-text + optional activity-area (A95 raw value retained on edit).
    reference: z.string(),
    notes: z.string(),
    activityAreaId: z.string(),
  });
}

export type TransactionFormValues = z.infer<
  ReturnType<typeof buildTransactionSchema>
>;

import { z } from "zod";

/**
 * Form sub-recipe (E22-S3, DEC-2 = RHF+Zod) — the retention policy edit schema.
 *
 * Behaviour-preserving (A79): the god-page edit form required nothing beyond a
 * `retentionMonths` number `>= 1` (the `<input min="1">` + `parseInt(...) || 1`
 * fallback). `displayName`/`legalBasis` are free text submitted byte-identical
 * (A96: NO `.trim()`/transform — the god-page sent the raw strings). `isActive`
 * is a boolean checkbox. `dataCategory` is READ-ONLY (not in the form) so it is
 * absent from the schema.
 *
 * A95 (action widening): the `<select>` only OFFERS Anonymize/Archive/Delete, but
 * a stored policy's `action` can be any transport value; the schema ACCEPTS the
 * full `RetentionAction` set so a no-touch edit-save round-trips an out-of-set
 * value unchanged, and the form renders an extra `<option>` for it.
 */

/** The 3 actions the edit-form select offers. */
export const RETENTION_ACTIONS = ["Anonymize", "Archive", "Delete"] as const;

export const retentionFormSchema = z.object({
  displayName: z.string(),
  retentionMonths: z.coerce.number().min(1, "validation.retentionMonthsMin"),
  // A95: accept ANY stored `action` string rather than `z.enum(...)`. The
  // `<select>` constrains the UI to the 3 offered values (RETENTION_ACTIONS) plus
  // an extra `<option>` for an out-of-set stored value, so a no-touch edit-save
  // round-trips that value unchanged (god-page parity — it held the raw value in
  // state). `z.enum` would instead REJECT an out-of-set value, defeating the
  // round-trip the form renders the extra option for.
  action: z.string().min(1, "validation.actionRequired"),
  // `legalBasis` is free text; an empty string maps to `null` at build time (the
  // god-page sent `e.target.value || null`). Carried as a plain string here.
  legalBasis: z.string(),
  isActive: z.boolean(),
});

export type RetentionFormValues = z.infer<typeof retentionFormSchema>;

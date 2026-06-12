import { z } from "zod";

/**
 * Activity-area create/edit form schema (E26-S4 form sub-recipe, E22 RHF+Zod).
 *
 * Required-ness MATCHES the god-page enable-gate EXACTLY: `!form.name || !form.code`
 * disables Save → name + code are the only required fields. A96: NO `.trim()` on any
 * submitted byte (name/code/description/color round-trip verbatim) — use `.min(1)` for the
 * non-empty gate, NOT `.trim().min(1)`. `description`/`color` stay optional plain strings
 * (the god-page maps "" → null on submit; the form holds the raw string). `isActive` is a
 * boolean toggle (edit-only in the UI; the create payload omits it). `sortOrder` is a number.
 */
export const activityAreaFormSchema = z.object({
  name: z.string().min(1, "form.required"),
  code: z.string().min(1, "form.required"),
  description: z.string(),
  color: z.string(),
  sortOrder: z.number(),
  isActive: z.boolean(),
});

export type ActivityAreaFormSchemaValues = z.infer<
  typeof activityAreaFormSchema
>;

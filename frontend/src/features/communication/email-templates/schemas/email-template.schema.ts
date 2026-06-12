import { z } from "zod";

/**
 * Form sub-recipe (E22-S3, DEC-2) — the shared new/edit Zod schema for an email
 * template (E25-S4).
 *
 * Behaviour-preserving (A79) — VERIFIED against the god-page form: the manual
 * `useState` form used native HTML5 `required` ONLY on `name` and `subject` (the
 * `category <select>` always has a value; `description` / `htmlContent` /
 * `textContent` carried NO `required`). To preserve that exactly, only `name` and
 * `subject` get `.min(1, "form.required")`; the rest stay plain strings. The
 * required message is a next-intl key rendered via `t(errors.x.message)`.
 *
 * The `variables` array is NOT an RHF field — it mirrors the god-page's separate
 * `newVariable` + `formData.variables` state and is folded into the submitted
 * payload by the form (see `email-template-form.tsx`).
 */
export const emailTemplateFormSchema = z.object({
  // NO `.trim()` transform (A79 byte-identical payload): the god-page sent the RAW
  // (untrimmed) value to `onSave`, so the resolved value must NOT be mutated. The
  // emptiness check stays as a non-mutating `.min(1)` — the god-page's HTML5
  // `required` likewise only blocked the truly-empty `""` (whitespace-only passed).
  name: z.string().min(1, "form.required"),
  subject: z.string().min(1, "form.required"),
  category: z.string(),
  description: z.string(),
  htmlContent: z.string(),
  textContent: z.string(),
});

export type EmailTemplateFormValues = z.infer<typeof emailTemplateFormSchema>;

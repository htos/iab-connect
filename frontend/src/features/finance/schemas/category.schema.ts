import { z } from "zod";

/**
 * Category create/edit form schema (E26-S4 form sub-recipe, E22 RHF+Zod).
 *
 * Required-ness MATCHES the god-page enable-gate EXACTLY: `!form.name` disables Save →
 * name is the ONLY required field. A96: NO `.trim()` on the submitted bytes (name + color
 * round-trip verbatim — the god-page POSTs the form as-is). `type` is the closed
 * Income/Expense set (`z.enum`); `color` is a free string (color picker / hex input);
 * `isActive` is a boolean checkbox.
 */
export const categoryFormSchema = z.object({
  name: z.string().min(1, "form.required"),
  type: z.enum(["Income", "Expense"]),
  color: z.string(),
  isActive: z.boolean(),
});

export type CategoryFormSchemaValues = z.infer<typeof categoryFormSchema>;

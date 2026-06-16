import { z } from "zod";

/**
 * Settings activity-area form schema (E26-S6) — E22 RHF+Zod sub-recipe. Behaviour-preserving
 * (A79/A96):
 *
 * - **DEC-3 = A:** this is the SETTINGS activity-area form (distinct route/component from S4's
 *   budgeting `finance/activity-areas` page). The shared `ActivityArea` TYPE comes from the S2
 *   foundation; the FORM here OMITS `isActive` (the settings create payload has no isActive;
 *   edit hard-codes `isActive: true` at the hook boundary). The form values cover name/code/
 *   description/color/sortOrder only.
 *
 * - **A96:** NO `.trim()` on name/code/description/color. The `"" → null` optional mapping for
 *   description/color lives in the hook/content layer (a wire concern).
 *
 * - **DEC-2 = A (required-ness MATCHES the god-page enable-gate):** the save button is
 *   `disabled={saving || !form.name || !form.code}` → name + code required via `.min(1)` (NOT
 *   `.trim()`). Everything else permissive.
 */
export const settingsActivityAreaFormSchema = z.object({
  // A96: required via .min(1), no .trim().
  name: z.string().min(1, "form.required"),
  code: z.string().min(1, "form.required"),
  description: z.string(),
  color: z.string(),
  sortOrder: z.number(),
});

export type SettingsActivityAreaFormValues = z.infer<
  typeof settingsActivityAreaFormSchema
>;

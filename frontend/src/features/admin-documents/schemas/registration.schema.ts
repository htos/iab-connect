import { z } from "zod";

/**
 * Public registration form schema (E27-S6). Applies the E22 RHF+Zod sub-recipe
 * to replace the god-page's manual `handleSubmit` validation (A96 field errors).
 *
 * Behaviour preserved (A79 / pinned by the E27-S1 register net):
 *  - all 5 fields required (firstName/lastName/email/password/confirmPassword);
 *  - password min length 8 → `registration.passwordTooShort`;
 *  - password === confirmPassword → `registration.passwordMismatch` (god-page
 *    checked the MISMATCH before the too-short check, so mismatch wins when both
 *    fail — replicated by ordering the refinements: too-short is a field-level
 *    rule on `password`; mismatch is a form-level `.refine` reported on
 *    `confirmPassword`; RHF surfaces both but the page's single banner showed
 *    mismatch first — see the content's error selection).
 *  - A96: NO `.trim()`/transform on the submitted byte fields; the values are
 *    sent to `registerUser` verbatim (god-page sent `formData.x` raw).
 *
 * Required is a `.min(1)` → `form.required` key (rendered via `t(message)`),
 * matching the Members recipe. No new `.email()` constraint is added (the
 * god-page relied on the browser `type="email"`, which we keep on the input).
 */
export const registrationFormSchema = z
  .object({
    firstName: z.string().min(1, "form.required"),
    lastName: z.string().min(1, "form.required"),
    email: z.string().min(1, "form.required"),
    password: z.string().min(8, "registration.passwordTooShort"),
    confirmPassword: z.string().min(1, "form.required"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "registration.passwordMismatch",
    path: ["confirmPassword"],
  });

export type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

import { z } from "zod";

/**
 * Admin user create/edit form schemas — the E22 RHF+Zod form sub-recipe applied
 * to the admin-users slice (E27-S2).
 *
 * A96: NO `.trim()`/transform on submitted-byte fields — the raw bytes the user
 * typed are what gets sent (the god-pages sent `formData.email` verbatim). The
 * forms render `<form noValidate>` and surface per-field Zod errors.
 *
 * Message keys are `users.*` keys (the create/edit pages use
 * `useTranslations("users")`), rendered via `t(errors.x.message)`. They are the
 * SAME custom messages the S1 god-page validation produced as a banner
 * (`emailRequired`, `passwordOrInvitationRequired`) — now rendered as per-field
 * errors so the regression-net assertions (`findByText("emailRequired")` /
 * `"passwordOrInvitationRequired"`, and `createUser` NOT called) hold while the
 * gating moves from an imperative handler into the resolver (A79).
 */

// --- Create ---
//
// `email` required via `.min(1, "emailRequired")` (the story's `.min(1)` rule,
// carrying the god-page's `emailRequired` message). The cross-field
// "send-invitation OR temporary-password" rule is a `.superRefine` attached to
// the `temporaryPassword` path so it renders beneath that field and matches the
// god-page's `passwordOrInvitationRequired` guard.
export const createUserFormSchema = z
  .object({
    email: z.string().min(1, "emailRequired"),
    firstName: z.string(),
    lastName: z.string(),
    enabled: z.boolean(),
    sendInvitation: z.boolean(),
    temporaryPassword: z.string(),
    roles: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    if (!values.sendInvitation && !values.temporaryPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "passwordOrInvitationRequired",
        path: ["temporaryPassword"],
      });
    }
  });

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

// --- Edit ---
//
// Edit has no invitation/temporary-password fields; it adds `emailVerified`
// (edit-only). `email` required, same message.
export const editUserFormSchema = z.object({
  email: z.string().min(1, "emailRequired"),
  firstName: z.string(),
  lastName: z.string(),
  enabled: z.boolean(),
  emailVerified: z.boolean(),
  roles: z.array(z.string()),
});

export type EditUserFormValues = z.infer<typeof editUserFormSchema>;

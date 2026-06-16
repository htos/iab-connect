import { z } from "zod";
import { MembershipType } from "../types/member.types";

/**
 * Member new/edit form schema — applies the E22 RHF+Zod form sub-recipe to the
 * Members feature (E23-S2). Behaviour-preserving (A79): `required` mirrors the
 * god-pages' HTML5 `required` (firstName, lastName, email, street, postalCode,
 * city); `phone` + `country` stay optional plain strings; NO new `.email()`/
 * `.url()` constraints are introduced. The required message is a next-intl key
 * rendered via `t(errors.x.message)`. `membershipType` is in the schema for both
 * modes (always a valid enum, defaulted) but the field is only RENDERED in
 * create mode and only sent on the create request (edit strips it — the
 * god-page edit never sent it).
 */
export const memberFormSchema = z.object({
  firstName: z.string().trim().min(1, "form.required"),
  lastName: z.string().trim().min(1, "form.required"),
  email: z.string().trim().min(1, "form.required"),
  phone: z.string(),
  street: z.string().trim().min(1, "form.required"),
  postalCode: z.string().trim().min(1, "form.required"),
  city: z.string().trim().min(1, "form.required"),
  country: z.string(),
  membershipType: z.nativeEnum(MembershipType),
});

export type MemberFormValues = z.infer<typeof memberFormSchema>;

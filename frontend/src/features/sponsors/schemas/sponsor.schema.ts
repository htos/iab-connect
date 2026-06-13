import { z } from "zod";

/**
 * Form sub-recipe (E22-S3, DEC-1) — the shared new/edit Zod schema.
 *
 * Behaviour-preserving (A79): the required fields mirror the original HTML5
 * `required` attributes (companyName + tier). The other fields stay optional
 * plain strings — the old manual form applied NO format validation beyond the
 * native input `type`, so adding strict `.email()`/`.url()` here would reject
 * values the previous form accepted (a behaviour change). `tier` is the 4-value
 * enum and always has a value (the select defaults to "Bronze"). The required
 * message is a next-intl key, rendered via `t(errors.x.message)`.
 *
 * This schema + the shared `sponsor-form` component + the mutation-invalidation
 * pattern are the template every later domain epic (E23+) inherits — see
 * `docs/architecture-frontend.md` "Form sub-recipe".
 */
export const sponsorFormSchema = z.object({
  companyName: z.string().trim().min(1, "form.required"),
  contactPerson: z.string(),
  tier: z.enum(["Bronze", "Silver", "Gold", "Platinum"]),
  email: z.string(),
  phone: z.string(),
  website: z.string(),
  agreementStart: z.string(),
  agreementEnd: z.string(),
  notes: z.string(),
});

export type SponsorFormValues = z.infer<typeof sponsorFormSchema>;

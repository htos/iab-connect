import { z } from "zod";

/**
 * Supplier new/edit form schema — applies the E22-S3 form sub-recipe (RHF + Zod)
 * to the Suppliers feature (E22-S4, completing the E21 pilot). 7 fields (no tier,
 * no agreement dates — that is Sponsor-specific). Required mirrors the original
 * HTML5 `required` (companyName); the rest stay optional plain strings
 * (behaviour-preserving, A79). The required message is a next-intl key rendered
 * via `t(errors.x.message)`. See `docs/architecture-frontend.md` "Form sub-recipe".
 */
export const supplierFormSchema = z.object({
  companyName: z.string().trim().min(1, "form.required"),
  contactPerson: z.string(),
  category: z.string(),
  email: z.string(),
  phone: z.string(),
  website: z.string(),
  notes: z.string(),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

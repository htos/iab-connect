import { z } from "zod";

/**
 * Custom-role create/edit form schema (E27-S3, DEC-2 = RHF+Zod form sub-recipe).
 *
 * A95 — `linkedRole` widening: the god-page `<select>` offered exactly the three
 * canonical values (Admin / Vorstand / Member), but the transport `linkedRole` is a
 * free string on the backend. A stored role whose value is OUT of that set would
 * silently coerce to the first option on edit (data loss). The Zod field accepts the
 * full transport set (a plain string), so an out-of-set stored value round-trips; the
 * FORM renders the three canonical options PLUS an extra `<option>` for any out-of-set
 * current value (in `custom-role-form`).
 *
 * A96 — NO `.trim()`/transform on submitted-byte fields. The god-page's only gate was
 * the disabled submit button (`!roleForm.name.trim()`); we mirror that as `name.min(1)`
 * after a trim CHECK (NOT a value mutation) so an all-whitespace name is rejected while
 * the submitted bytes stay byte-identical. `<form noValidate>` surfaces the field error.
 */
const CANONICAL_LINKED_ROLES = ["Admin", "Vorstand", "Member"] as const;

export const customRoleSchema = z.object({
  // Reject blank/whitespace-only names (god-page disabled-submit parity) without
  // mutating the value — `.refine` checks a trimmed copy, the stored value is raw.
  name: z
    .string()
    .refine((v) => v.trim().length > 0, { message: "form.required" }),
  description: z.string(),
  // A95: a plain string (widened past the canonical three) so an out-of-set stored
  // value round-trips. The form renders the canonical options + the stored extra.
  linkedRole: z.string(),
  color: z.string(),
  sortOrder: z.number().int().min(0),
  // Rendered + sent only in edit mode (create strips it). Always present in the form
  // state (defaults true) so the create branch can omit it cleanly.
  isActive: z.boolean(),
});

export type CustomRoleValues = z.infer<typeof customRoleSchema>;

export { CANONICAL_LINKED_ROLES };

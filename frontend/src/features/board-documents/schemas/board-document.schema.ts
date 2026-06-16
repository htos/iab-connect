import { z } from "zod";

/**
 * Board-documents form schemas (E29-S3, DEC-2 = A — the E22 RHF+Zod sub-recipe).
 *
 * Behaviour-preserving (A79): validation is added ONLY where the god-page's HTML
 * form already required a value. The tag editor was a free-text comma-list with
 * NO validation, and it STAYS that way — `tagInput` is an unconstrained string;
 * the only reason it is a schema at all is to ride the shared RHF+Zod recipe.
 * The upload-metadata form's only hard requirement on the god-page was a chosen
 * FILE (the submit button was `disabled={!uploadFile || uploading}`); `name`
 * defaulted to the file name and `category` defaulted to "General", so neither
 * is strictly required by Zod (matching what the old form accepted). The
 * required message is a next-intl key, rendered via `t(errors.x.message)`.
 */

// Tag editor: free-text comma-separated list, no constraint (god-page parity).
export const boardDocumentTagsSchema = z.object({
  tagInput: z.string(),
});

export type BoardDocumentTagsValues = z.infer<typeof boardDocumentTagsSchema>;

// Upload metadata: name / description / category / tags. None are required by
// Zod (the god-page only gated submit on a chosen file, handled outside the
// form values); the schema exists to type the form + ride the RHF+Zod recipe.
export const boardDocumentUploadSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.string(),
});

export type BoardDocumentUploadValues = z.infer<
  typeof boardDocumentUploadSchema
>;

// Version-upload metadata: an optional free-text comment (the file is gated
// outside the form values, as on the god-page).
export const boardDocumentVersionSchema = z.object({
  comment: z.string(),
});

export type BoardDocumentVersionValues = z.infer<
  typeof boardDocumentVersionSchema
>;

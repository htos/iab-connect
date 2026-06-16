import { z } from "zod";

/**
 * Create/edit folder form schema (E27-S6). Applies the E22 RHF+Zod form
 * sub-recipe. Behaviour-preserving (A79): the god-page gated save on
 * `name.trim()` being non-empty (`disabled={!newFolderName.trim()}`), so a
 * name of pure whitespace was never submittable. We mirror that gate with a
 * `.refine` on the trimmed value — but per A96 we do NOT `.trim()`/transform the
 * SUBMITTED value (the bytes the user typed are sent verbatim to the service,
 * exactly as the god-page did with `name: newFolderName`). `description` stays
 * an optional plain string (sent as `description || undefined` by the caller,
 * matching the god-page).
 */
export const folderFormSchema = z.object({
  name: z.string().refine((v) => v.trim().length > 0, "form.required"),
  description: z.string(),
});

export type FolderFormValues = z.infer<typeof folderFormSchema>;

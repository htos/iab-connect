import { z } from "zod";

/**
 * Invoice new/edit form schema — the E22 RHF+Zod sub-recipe applied to the invoice
 * form (E26-S3). Behaviour-preserving (A79/A95/A96), it carries the program's central
 * `recipientType "Other"` trap:
 *
 * - **A95 (load-bearing):** `recipientType` is a FULL `z.string()` union — NEVER
 *   `z.enum(["Member", "External"])`. The god-page renders + POSTs the literal `"Other"`
 *   (its state union is `"Member" | "Other"`), while the canonical `RecipientType` is
 *   `"Member" | "External"`. The Zod field must accept whatever the `<select>` holds and
 *   POST it byte-identically; the content renders the raw stored value as an extra
 *   `<option>` if it is out of the rendered set, so a no-touch edit-save round-trips it.
 *
 * - **A96:** NO `.trim()` / transform on any submitted-byte field (recipient name/address,
 *   line descriptions) — the god-page sends raw input. The required-ness MATCHES the
 *   god-page enable-gate, which is only `disabled={loading}` (i.e. effectively NO required
 *   fields; submit must stay possible with an empty recipient/items). The server validates.
 *   The form renders with `noValidate` so any per-field Zod error WOULD render (A96
 *   companion) — but the permissive schema produces none for the inputs the god-page
 *   accepted.
 */
export const invoiceLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  taxCodeId: z.string(),
  taxRate: z.number(),
  isGrossEntry: z.boolean(),
  activityAreaId: z.string(),
});

export const invoiceFormSchema = z.object({
  date: z.string(),
  dueDate: z.string(),
  // A95: full transport union, NOT z.enum(rendered subset). Keep raw value byte-identical.
  recipientType: z.string(),
  recipientId: z.string(),
  // A96: no .trim() — raw bytes POSTed as typed.
  recipientName: z.string(),
  recipientAddress: z.string(),
  items: z.array(invoiceLineItemSchema),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
export type InvoiceLineItemValues = z.infer<typeof invoiceLineItemSchema>;

import { z } from "zod";

/**
 * Form sub-recipe (E22-S3, DEC-2) — the shared create/edit Zod schema for a webhook
 * subscription (E27-S5).
 *
 * Behaviour-preserving (A79) — VERIFIED against the god-page validation: the
 * god-page's save button was disabled unless `name.trim()` AND `targetUrl.trim()`
 * AND `selectedTypes.length >= 1`. To preserve that EXACTLY:
 *   - A96: validate non-empty-after-trim WITHOUT mutating the submitted value — use
 *     `.refine((v) => v.trim().length > 0)` (NOT `.trim()`/transform), so the PUT/POST
 *     body stays byte-identical to the god-page (which submitted the raw input value).
 *   - The god-page applied NO URL-format check on `targetUrl` (only non-empty after
 *     trim) — do NOT tighten to `z.string().url()` (it would reject values the native
 *     form accepted — a behaviour change).
 *   - `eventTypes` must have `.min(1)`. A95: a no-touch edit round-trips the STORED
 *     eventTypes verbatim even if some are not in the current availableEventTypes, so
 *     the schema only checks the count — it never restricts the members to a known set.
 * The messages are next-intl keys rendered via `t(errors.x.message)`.
 */
export const webhookFormSchema = z.object({
  name: z.string().refine((v) => v.trim().length > 0, "required"),
  targetUrl: z.string().refine((v) => v.trim().length > 0, "required"),
  eventTypes: z.array(z.string()).min(1, "required"),
});

export type WebhookFormValues = z.infer<typeof webhookFormSchema>;

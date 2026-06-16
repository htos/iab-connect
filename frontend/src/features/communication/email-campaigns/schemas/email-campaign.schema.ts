import { z } from "zod";
import type { RecipientSegmentType } from "../types/email-campaign.types";

/**
 * Form sub-recipe (E22-S3, DEC-2) — the shared new/edit Zod schema for an email
 * campaign (E25-S3).
 *
 * Behaviour-preserving (A79) — VERIFIED against the god-page validation: the
 * god-pages used ONLY native HTML5 `required` on name / subject / fromName /
 * fromEmail (the editor `htmlContent` and `segmentType <select>` carried NO
 * `required`). To preserve that exactly (the S1 net submits with an empty
 * `htmlContent` and still POSTs), `htmlContent` / `plainTextContent` /
 * `replyToEmail` / `segmentFilter` stay plain (optional) strings, and only the
 * four native-required fields get `.min(1)`. The god-pages applied NO format
 * validation beyond the native input `type`, so `fromEmail` / `replyToEmail`
 * stay plain strings (adding `.email()` would reject values the native form
 * accepted — a behaviour change). The required message is a next-intl key
 * rendered via `t(errors.x.message)`. `segmentType` is the form-option enum and
 * always has a value (the select defaults to "AllActiveMembers").
 *
 * The full set of selectable segment types are the 5 the god-page offered in the
 * `<select>`; `Manual` (the 6th transport enum) was never a form option, so a
 * loaded campaign carrying it falls back to the form default at `buildDefaultValues`.
 */
export const SEGMENT_TYPE_OPTIONS = [
  "AllActiveMembers",
  "NewsletterSubscribers",
  "EventParticipants",
  "MemberSegment",
  "Custom",
] as const satisfies readonly RecipientSegmentType[];

export const emailCampaignFormSchema = z.object({
  // Validate emptiness WITHOUT mutating: native HTML5 `required` blocked the empty
  // string but never trimmed the submitted value, so `.min(1)` (NOT `.trim()`)
  // keeps the POST body byte-identical to the god-page (A79).
  name: z.string().min(1, "form.required"),
  subject: z.string().min(1, "form.required"),
  htmlContent: z.string(),
  plainTextContent: z.string(),
  fromName: z.string().min(1, "form.required"),
  fromEmail: z.string().min(1, "form.required"),
  replyToEmail: z.string(),
  segmentType: z.enum([
    "AllActiveMembers",
    "NewsletterSubscribers",
    "EventParticipants",
    "MemberSegment",
    "Custom",
  ]),
  segmentFilter: z.string(),
});

export type EmailCampaignFormValues = z.infer<typeof emailCampaignFormSchema>;

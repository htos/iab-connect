import { z } from "zod";

/**
 * Form sub-recipe (E22-S3, DEC-2) — the shared new/edit automation Zod schema.
 *
 * Behaviour-preserving (A79): the required set mirrors the god-page's
 * `clientValidate` EXACTLY — name, templateId, offsetDays-when-time-relative
 * (`>= 0`), segmentFilter-when-MemberSegment — and reuses the same next-intl
 * message keys (`validation.nameRequired` / `validation.templateRequired` /
 * `validation.offsetRequired` / `validation.segmentRequired`) so the rendered
 * message is identical. The conditional rules need cross-field access, so they
 * live in `.superRefine`. `templateId` and `offsetDays` carry the form's empty
 * sentinel (`""`) in their input shape (the selects default to "") — the build
 * step coerces them to numbers for the request.
 */
export const TRIGGER_TYPES = [
  "MemberJoined",
  "EventUpcoming",
  "MembershipRenewalDue",
  "Scheduled",
  "Manual",
] as const;

export const SEGMENT_TYPES = [
  "AllActiveMembers",
  "NewsletterSubscribers",
  "MemberSegment",
] as const;

export const CONSENT_TYPES = [
  "Newsletter",
  "EventNotifications",
  "Marketing",
] as const;

/**
 * Full transport unions (byte-match `RecipientSegmentType` / `ConsentType` in
 * `automations`). The form `<select>`s only OFFER the 3-option subsets
 * above, but an existing automation's stored value can be any transport value;
 * the schema must ACCEPT the full set so a no-touch edit-save round-trips the
 * original value unchanged (god-page parity — it held the raw value in state).
 */
const ALL_SEGMENT_TYPES = [
  "AllActiveMembers",
  "Custom",
  "Manual",
  "EventParticipants",
  "NewsletterSubscribers",
  "MemberSegment",
] as const;

const ALL_CONSENT_TYPES = [
  "DataProcessing",
  "Newsletter",
  "Marketing",
  "EventNotifications",
  "PhotoUsage",
] as const;

/** Trigger types that carry an offset-in-days parameter (mirrors `isTimeRelative`). */
const TIME_RELATIVE_TRIGGERS: readonly string[] = [
  "EventUpcoming",
  "MembershipRenewalDue",
];

export const automationFormSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    templateId: z.union([z.number(), z.literal("")]),
    triggerType: z.enum(TRIGGER_TYPES),
    offsetDays: z.union([z.number(), z.literal("")]),
    segmentType: z.enum(ALL_SEGMENT_TYPES),
    segmentFilter: z.string(),
    consentFilter: z.union([z.enum(ALL_CONSENT_TYPES), z.literal("")]),
  })
  .superRefine((values, ctx) => {
    if (!values.name.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "validation.nameRequired",
      });
    }
    if (!values.templateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["templateId"],
        message: "validation.templateRequired",
      });
    }
    if (
      TIME_RELATIVE_TRIGGERS.includes(values.triggerType) &&
      (values.offsetDays === "" || Number(values.offsetDays) < 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["offsetDays"],
        message: "validation.offsetRequired",
      });
    }
    if (values.segmentType === "MemberSegment" && !values.segmentFilter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["segmentFilter"],
        message: "validation.segmentRequired",
      });
    }
  });

export type AutomationFormValues = z.infer<typeof automationFormSchema>;

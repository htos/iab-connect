// Shared recipient-segment enum (E31-S1, DEC-2). Lives in `@/types` (a lib-leaf,
// import-legal from any feature) because it is consumed by BOTH the
// `communication/email-campaigns` and `communication/automations` sub-slices; a
// feature-owned home would force a cross-feature import (E21-S5). Relocated
// verbatim from the now-retired `email-campaigns`.
export type RecipientSegmentType =
  | "AllActiveMembers"
  | "Custom"
  | "Manual"
  | "EventParticipants"
  | "NewsletterSubscribers"
  | "MemberSegment";

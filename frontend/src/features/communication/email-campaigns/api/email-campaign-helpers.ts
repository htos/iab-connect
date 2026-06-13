// Email-campaign presentation helpers (E31-S1; relocated off the retired
// `email-campaigns`). Only `getSegmentTypeLabel` is live (consumed by
// the campaign form's segment dropdown). The legacy module's `getStatusColor` /
// `getRecipientStatusColor` had ZERO importers (the badges use semantic token
// variants, not the raw brand strings) and are intentionally NOT relocated
// (E31-S1 DEC-5 = B; they retire with the lib module in E31-S2).
import type { RecipientSegmentType } from "../types/email-campaign.types";

export function getSegmentTypeLabel(type: RecipientSegmentType): string {
  switch (type) {
    case "AllActiveMembers":
      return "Alle aktiven Mitglieder";
    case "Custom":
      return "Benutzerdefiniert";
    case "Manual":
      return "Manuell ausgewählt";
    case "EventParticipants":
      return "Event-Teilnehmer";
    case "NewsletterSubscribers":
      return "Newsletter-Abonnenten";
    case "MemberSegment":
      return "Mitglieder-Segment";
    default:
      return type;
  }
}

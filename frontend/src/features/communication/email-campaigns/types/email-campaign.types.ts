// Email-campaigns feature types (E25-S3, DEC-3 = re-export). The DTOs/enums + the
// status/recipient/segment label helpers already live in `@/lib/api/email-campaigns`
// (a `features → lib` import is boundary-legal); per the E23/E29 re-export pattern
// we surface them from the slice so feature code never reaches across to
// `@/lib/api/email-campaigns` directly. Components/hooks import from here.
export type {
  EmailCampaignStatus,
  EmailRecipientStatus,
  RecipientSegmentType,
  BounceType,
  EmailCampaignDto,
  EmailRecipientDto,
  EmailCampaignStatistics,
  RecipientPreview,
  CreateEmailCampaignRequest,
  UpdateEmailCampaignRequest,
  SendTestEmailRequest,
  ScheduleCampaignRequest,
  PreviewRecipientsRequest,
  PagedResponse,
} from "@/lib/api/email-campaigns";

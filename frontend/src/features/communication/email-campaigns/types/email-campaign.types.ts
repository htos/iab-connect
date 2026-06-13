// Email-campaigns feature types (E25-S3; relocated in E31-S1 off the retired
// `email-campaigns`). The DTOs/enums now live HERE (the owning slice);
// the cross-sub-slice `RecipientSegmentType` is re-exported from its shared
// `@/types/email-campaigns` home (DEC-2), and `PagedResponse` from `@/types/common`.
// REQ-026: E-Mail Kampagnen.

export type { RecipientSegmentType } from "@/types/email-campaigns";
import type { RecipientSegmentType } from "@/types/email-campaigns";

// Paginated Response (re-exported from common)
export type { PagedResult as PagedResponse } from "@/types/common";

// Enums
export type EmailCampaignStatus =
  | "Draft"
  | "Scheduled"
  | "Sending"
  | "Sent"
  | "Cancelled"
  | "Failed";

export type EmailRecipientStatus =
  | "Pending"
  | "Queued"
  | "Sent"
  | "Delivered"
  | "Opened"
  | "Clicked"
  | "Bounced"
  | "Failed"
  | "Unsubscribed"
  | "Skipped";

export type BounceType = "Hard" | "Soft";

// DTOs
export interface EmailCampaignDto {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  plainTextContent?: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  segmentType: RecipientSegmentType;
  segmentFilter?: string;
  eventId?: string;
  status: EmailCampaignStatus;
  scheduledAt?: string;
  sentAt?: string;
  completedAt?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  failedCount: number;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EmailRecipientDto {
  id: string;
  campaignId: string;
  memberId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: EmailRecipientStatus;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  bouncedAt?: string;
  bounceType?: BounceType;
  bounceMessage?: string;
  errorMessage?: string;
}

export interface EmailCampaignStatistics {
  totalRecipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface RecipientPreview {
  memberId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

// Request DTOs
export interface CreateEmailCampaignRequest {
  name: string;
  subject: string;
  htmlContent: string;
  plainTextContent?: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  segmentType: RecipientSegmentType;
  segmentFilter?: string;
  eventId?: string;
}

export interface UpdateEmailCampaignRequest extends CreateEmailCampaignRequest {}

export interface SendTestEmailRequest {
  testEmail: string;
}

export interface ScheduleCampaignRequest {
  scheduledAt: string;
}

export interface PreviewRecipientsRequest {
  segmentType: RecipientSegmentType;
  segmentFilter?: string;
}

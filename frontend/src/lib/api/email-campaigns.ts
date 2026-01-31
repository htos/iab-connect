/**
 * REQ-026: E-Mail Kampagnen API Types und Funktionen
 */

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

export type RecipientSegmentType =
  | "AllActiveMembers"
  | "Custom"
  | "Manual"
  | "EventParticipants"
  | "NewsletterSubscribers";

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

// Paginated Response
export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

// Status helpers
export function getStatusColor(status: EmailCampaignStatus): string {
  switch (status) {
    case "Draft":
      return "bg-gray-100 text-gray-800";
    case "Scheduled":
      return "bg-blue-100 text-blue-800";
    case "Sending":
      return "bg-yellow-100 text-yellow-800";
    case "Sent":
      return "bg-green-100 text-green-800";
    case "Cancelled":
      return "bg-orange-100 text-orange-800";
    case "Failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getRecipientStatusColor(status: EmailRecipientStatus): string {
  switch (status) {
    case "Pending":
    case "Queued":
      return "bg-gray-100 text-gray-800";
    case "Sent":
      return "bg-blue-100 text-blue-800";
    case "Delivered":
      return "bg-green-100 text-green-800";
    case "Opened":
      return "bg-emerald-100 text-emerald-800";
    case "Clicked":
      return "bg-teal-100 text-teal-800";
    case "Bounced":
      return "bg-orange-100 text-orange-800";
    case "Failed":
      return "bg-red-100 text-red-800";
    case "Unsubscribed":
      return "bg-purple-100 text-purple-800";
    case "Skipped":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

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
    default:
      return type;
  }
}

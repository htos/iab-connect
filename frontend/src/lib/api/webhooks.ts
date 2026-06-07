/**
 * REQ-058 (E8-S3): typed client + endpoint paths for the webhook subscription admin surface.
 */

export const WEBHOOKS_BASE = "/api/v1/admin/webhooks";

export interface WebhookSubscriptionDto {
  id: string;
  name: string;
  targetUrl: string;
  eventTypes: string[];
  status: string;
  createdAt: string;
  updatedAt: string | null;
}

/** Create response — the ONLY shape carrying the one-time cleartext signing secret. */
export interface WebhookSubscriptionCreatedDto {
  id: string;
  name: string;
  targetUrl: string;
  eventTypes: string[];
  secret: string;
  createdAt: string;
}

export interface WebhookRequest {
  name: string;
  targetUrl: string;
  eventTypes: string[];
}

export const WEBHOOK_DELIVERIES_BASE = "/api/v1/admin/webhook-deliveries";

/** REQ-058 (E8-S4): metadata-only delivery history row (never the payload body or secret). */
export interface WebhookDeliveryDto {
  id: string;
  subscriptionId: string;
  eventType: string;
  targetUrl: string;
  status: string;
  attemptCount: number;
  responseStatusCode: number | null;
  error: string | null;
  createdAt: string;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Webhook-deliveries feature API (E27-S5). DEC-1 = A BUILD on `useApiClient`.
// `webhooks` exports the SEPARATE delivery URL base
// (`WEBHOOK_DELIVERIES_BASE`, distinct from `WEBHOOKS_BASE`) + the metadata-only
// row DTO. URL is BYTE-IDENTICAL to the god-page:
//   - list: GET `${BASE}/?page=<page>&pageSize=<pageSize>` (trailing slash before `?`)
// Metadata-only / read-only surface: NO filters, NO retry action, the payload body
// is never fetched or rendered (AC-2). The URL base moves into the slice here.
import { WEBHOOK_DELIVERIES_BASE } from "./webhooks";
import type { useApiClient } from "@/lib/auth";
import type {
  WebhookDeliveryDto,
  PagedResult,
} from "../types/admin-integrations.types";

type WebhookDeliveriesApiClient = ReturnType<typeof useApiClient>;

export { WEBHOOK_DELIVERIES_BASE };

export const PAGE_SIZE = 20;

/**
 * Query-key convention. The page index is part of the key so TanStack refetches on
 * prev/next (replacing the god-page's manual `page` effect). `pageSize` is fixed at
 * 20, so it is not threaded into the key.
 */
export const webhookDeliveriesKeys = {
  all: ["admin-webhook-deliveries"] as const,
  list: (page: number) => ["admin-webhook-deliveries", "list", page] as const,
};

/**
 * List deliveries for a page: GET `${BASE}/?page=<page>&pageSize=20`. Byte-identical
 * to the god-page (trailing slash before the query string, fixed pageSize=20).
 */
export function fetchWebhookDeliveries(
  api: WebhookDeliveriesApiClient,
  page: number
) {
  return api.get<PagedResult<WebhookDeliveryDto>>(
    `${WEBHOOK_DELIVERIES_BASE}/?page=${page}&pageSize=${PAGE_SIZE}`
  );
}

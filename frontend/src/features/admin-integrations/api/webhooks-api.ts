// Webhooks feature API (E27-S5). DEC-1 = A BUILD: `@/lib/api/webhooks` exports
// ONLY types + the URL base (`WEBHOOKS_BASE`); the god-page issued its requests via
// INLINE `useApiClient` calls. This layer BUILDS the transport on the E21-S1 DEC-1
// client contract ({ data, error, status }, never throws). URLs / bodies are
// BYTE-IDENTICAL to the god-page calls (verified line-by-line):
//   - list:        GET    `${BASE}/`            (trailing slash)
//   - event-types: GET    `${BASE}/event-types`
//   - create:      POST   `${BASE}/`            (trailing slash) { name, targetUrl, eventTypes }
//   - update:      PUT    `${BASE}/{id}`        (NO trailing slash) { name, targetUrl, eventTypes }
//   - enable:      POST   `${BASE}/{id}/enable`  {}  (NO trailing slash)
//   - disable:     POST   `${BASE}/{id}/disable` {}  (NO trailing slash)
//   - delete:      DELETE `${BASE}/{id}`        (NO trailing slash)
// The create response is the ONLY shape carrying the one-time cleartext signing
// secret; PUT/edit never returns a secret. The URL base moves into the slice here
// (E21-S1 rule 5). The DTOs stay in `@/lib/api/webhooks`.
import { WEBHOOKS_BASE } from "@/lib/api/webhooks";
import type { useApiClient } from "@/lib/auth";
import type {
  WebhookSubscriptionDto,
  WebhookSubscriptionCreatedDto,
  WebhookRequest,
} from "../types/admin-integrations.types";

type WebhooksApiClient = ReturnType<typeof useApiClient>;

export { WEBHOOKS_BASE };

/**
 * Query-key + invalidation convention. The subscription list + the available event
 * types are the read surfaces; create/update/toggle/delete mutations invalidate
 * `webhooksKeys.list`. The show-once signing secret is local panel state (NOT
 * server state) — never part of a key.
 */
export const webhooksKeys = {
  all: ["admin-webhooks"] as const,
  list: () => ["admin-webhooks", "list"] as const,
  eventTypes: () => ["admin-webhooks", "event-types"] as const,
};

/** List subscriptions: GET `${BASE}/` (trailing slash). */
export function fetchWebhooks(api: WebhooksApiClient) {
  return api.get<WebhookSubscriptionDto[]>(`${WEBHOOKS_BASE}/`);
}

/** Available event types for the dialog checkboxes: GET `${BASE}/event-types`. */
export function fetchWebhookEventTypes(api: WebhooksApiClient) {
  return api.get<string[]>(`${WEBHOOKS_BASE}/event-types`);
}

/**
 * Create a subscription: POST `${BASE}/` (trailing slash). The response is the ONLY
 * shape carrying the one-time cleartext signing secret.
 */
export function createWebhook(api: WebhooksApiClient, body: WebhookRequest) {
  return api.post<WebhookSubscriptionCreatedDto>(`${WEBHOOKS_BASE}/`, body);
}

/** Update a subscription: PUT `${BASE}/{id}` (no trailing slash). Never returns a secret. */
export function updateWebhook(
  api: WebhooksApiClient,
  id: string,
  body: WebhookRequest
) {
  return api.put(`${WEBHOOKS_BASE}/${id}`, body);
}

/**
 * Toggle a subscription's status: POST `${BASE}/{id}/{enable|disable}` with an empty
 * body. `enable` is selected when `disabled` is true, mirroring the god-page's
 * `status === "Active" ? "disable" : "enable"` (the caller passes the desired action).
 */
export function toggleWebhook(
  api: WebhooksApiClient,
  id: string,
  action: "enable" | "disable"
) {
  return api.post(`${WEBHOOKS_BASE}/${id}/${action}`, {});
}

/** Delete a subscription: DELETE `${BASE}/{id}` (no trailing slash). */
export function deleteWebhook(api: WebhooksApiClient, id: string) {
  return api.delete(`${WEBHOOKS_BASE}/${id}`);
}

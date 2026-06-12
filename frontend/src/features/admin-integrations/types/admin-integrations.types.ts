// Admin-integrations slice types (E27-S5). The DTOs + URL-base constants live in
// `@/lib/api/apiClients` and `@/lib/api/webhooks` (those modules export ONLY types
// + URL bases — there are no transport fns to wrap; A56). The slice re-exports them
// here so components/hooks import their types from inside the slice (relative), and
// the URL constants are owned by the slice `api/` modules (E21-S1 rule 5).

export type {
  ApiClientDto,
  ApiClientCreatedDto,
  CreateApiClientRequest,
} from "@/lib/api/apiClients";

export type {
  WebhookSubscriptionDto,
  WebhookSubscriptionCreatedDto,
  WebhookRequest,
  WebhookDeliveryDto,
  PagedResult,
} from "@/lib/api/webhooks";

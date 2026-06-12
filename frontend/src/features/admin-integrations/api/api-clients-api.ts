// Api-clients feature API (E27-S5). DEC-1 = A BUILD: there is NO `@/lib` client
// module to wrap — `@/lib/api/apiClients` exports ONLY types + the URL base
// (`API_CLIENTS_BASE`); the god-page issued its requests via INLINE `useApiClient`
// calls. So this layer BUILDS the transport on the E21-S1 DEC-1 client contract:
// the `useApiClient()` instance ({ data, error, status }, never throws). URLs /
// bodies are BYTE-IDENTICAL to the god-page calls (verified line-by-line):
//   - list:   GET  `${BASE}/`     (trailing slash)
//   - scopes: GET  `${BASE}/scopes`
//   - create: POST `${BASE}/`     (trailing slash) { name, scopes }
//   - revoke: POST `${BASE}/{id}/revoke` {}  (NO trailing slash)
// The URL base moves into the slice here (E21-S1 rule 5 — no raw `/api/v1` string
// in any component). The DTOs stay in `@/lib/api/apiClients` (re-exported via
// `types/admin-integrations.types`).
import { API_CLIENTS_BASE } from "@/lib/api/apiClients";
import type { useApiClient } from "@/lib/auth";
import type {
  ApiClientDto,
  ApiClientCreatedDto,
  CreateApiClientRequest,
} from "../types/admin-integrations.types";

type ApiClientsApiClient = ReturnType<typeof useApiClient>;

export { API_CLIENTS_BASE };

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). The list +
 * the available scopes are the two read surfaces; a create/revoke mutation
 * invalidates `apiClientsKeys.list` (the row set changes), never the show-once
 * secret (which is local panel state, NOT server state — data-loss invariant).
 */
export const apiClientsKeys = {
  all: ["admin-api-clients"] as const,
  list: () => ["admin-api-clients", "list"] as const,
  scopes: () => ["admin-api-clients", "scopes"] as const,
};

/** List clients. Byte-identical to the god-page: GET `${BASE}/` (trailing slash). */
export function fetchApiClients(api: ApiClientsApiClient) {
  return api.get<ApiClientDto[]>(`${API_CLIENTS_BASE}/`);
}

/** Available scopes for the create dialog: GET `${BASE}/scopes`. */
export function fetchApiClientScopes(api: ApiClientsApiClient) {
  return api.get<string[]>(`${API_CLIENTS_BASE}/scopes`);
}

/**
 * Create a client: POST `${BASE}/` (trailing slash) with `{ name, scopes }`. The
 * response is the ONLY shape carrying the one-time cleartext secret.
 */
export function createApiClient(
  api: ApiClientsApiClient,
  body: CreateApiClientRequest
) {
  return api.post<ApiClientCreatedDto>(`${API_CLIENTS_BASE}/`, body);
}

/** Revoke a client: POST `${BASE}/{id}/revoke` with an empty body (no trailing slash). */
export function revokeApiClient(api: ApiClientsApiClient, id: string) {
  return api.post(`${API_CLIENTS_BASE}/${id}/revoke`, {});
}

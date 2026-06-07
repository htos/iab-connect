/**
 * REQ-058 (E8-S1): typed client + endpoint paths for the external API credential admin surface.
 * Thin wrappers over the shared {@link useApiClient} hook — the page passes the hook's methods in so
 * auth/token handling stays centralized.
 */

export const API_CLIENTS_BASE = "/api/v1/admin/api-clients";

/** Admin list/detail view — never carries the secret or its hash. */
export interface ApiClientDto {
  id: string;
  name: string;
  scopes: string[];
  isRevoked: boolean;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

/** Create response — the ONLY shape carrying the one-time cleartext secret. */
export interface ApiClientCreatedDto {
  id: string;
  name: string;
  scopes: string[];
  secret: string;
  createdAt: string;
}

export interface CreateApiClientRequest {
  name: string;
  scopes: string[];
}

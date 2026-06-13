// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E27-S5: the admin-integrations slice api owns the per-resource query-key factories
 * and BUILDS the transport on the `useApiClient` contract (DEC-1 = A — there is no
 * `@/lib` client to wrap; `apiClients`+`webhooks` export ONLY types + URL
 * bases). These assert the key shapes and that each function calls the right
 * api-client method with a BYTE-IDENTICAL endpoint / body, with the EXACT trailing
 * slashes the god-pages used (list/create `/`; PUT/DELETE/enable/disable no slash;
 * deliveries `/?page=`) and the SEPARATE deliveries URL base.
 */

import {
  API_CLIENTS_BASE,
  apiClientsKeys,
  fetchApiClients,
  fetchApiClientScopes,
  createApiClient,
  revokeApiClient,
} from "./api-clients-api";
import {
  WEBHOOKS_BASE,
  webhooksKeys,
  fetchWebhooks,
  fetchWebhookEventTypes,
  createWebhook,
  updateWebhook,
  toggleWebhook,
  deleteWebhook,
} from "./webhooks-api";
import {
  WEBHOOK_DELIVERIES_BASE,
  PAGE_SIZE,
  webhookDeliveriesKeys,
  fetchWebhookDeliveries,
} from "./webhook-deliveries-api";

function makeApi() {
  return {
    get: vi.fn(() => Promise.resolve({ data: null, error: null, status: 200 })),
    post: vi.fn(() =>
      Promise.resolve({ data: null, error: null, status: 200 })
    ),
    put: vi.fn(() => Promise.resolve({ data: null, error: null, status: 200 })),
    delete: vi.fn(() =>
      Promise.resolve({ data: null, error: null, status: 200 })
    ),
    upload: vi.fn(),
  };
}

type Api = ReturnType<typeof makeApi>;

afterEach(() => vi.clearAllMocks());

describe("URL bases", () => {
  it("pins the three god-page URL bases (incl. the SEPARATE deliveries base)", () => {
    expect(API_CLIENTS_BASE).toBe("/api/v1/admin/api-clients");
    expect(WEBHOOKS_BASE).toBe("/api/v1/admin/webhooks");
    expect(WEBHOOK_DELIVERIES_BASE).toBe("/api/v1/admin/webhook-deliveries");
    expect(WEBHOOK_DELIVERIES_BASE).not.toBe(WEBHOOKS_BASE);
    expect(PAGE_SIZE).toBe(20);
  });
});

describe("api-clients keys + endpoints", () => {
  it("exposes stable key shapes", () => {
    expect(apiClientsKeys.all).toEqual(["admin-api-clients"]);
    expect(apiClientsKeys.list()).toEqual(["admin-api-clients", "list"]);
    expect(apiClientsKeys.scopes()).toEqual(["admin-api-clients", "scopes"]);
  });

  it("fetchApiClients GETs the trailing-slash list URL", () => {
    const api = makeApi() as unknown as Api;
    fetchApiClients(api);
    expect(api.get).toHaveBeenCalledWith("/api/v1/admin/api-clients/");
  });

  it("fetchApiClientScopes GETs /scopes", () => {
    const api = makeApi() as unknown as Api;
    fetchApiClientScopes(api);
    expect(api.get).toHaveBeenCalledWith("/api/v1/admin/api-clients/scopes");
  });

  it("createApiClient POSTs the trailing-slash base with the body", () => {
    const api = makeApi() as unknown as Api;
    const body = { name: "x", scopes: ["events:read"] };
    createApiClient(api, body);
    expect(api.post).toHaveBeenCalledWith("/api/v1/admin/api-clients/", body);
  });

  it("revokeApiClient POSTs /{id}/revoke with {} (no trailing slash)", () => {
    const api = makeApi() as unknown as Api;
    revokeApiClient(api, "7");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/admin/api-clients/7/revoke",
      {}
    );
  });
});

describe("webhooks keys + endpoints", () => {
  it("exposes stable key shapes", () => {
    expect(webhooksKeys.all).toEqual(["admin-webhooks"]);
    expect(webhooksKeys.list()).toEqual(["admin-webhooks", "list"]);
    expect(webhooksKeys.eventTypes()).toEqual([
      "admin-webhooks",
      "event-types",
    ]);
  });

  it("fetchWebhooks GETs the trailing-slash list URL", () => {
    const api = makeApi() as unknown as Api;
    fetchWebhooks(api);
    expect(api.get).toHaveBeenCalledWith("/api/v1/admin/webhooks/");
  });

  it("fetchWebhookEventTypes GETs /event-types", () => {
    const api = makeApi() as unknown as Api;
    fetchWebhookEventTypes(api);
    expect(api.get).toHaveBeenCalledWith("/api/v1/admin/webhooks/event-types");
  });

  it("createWebhook POSTs the trailing-slash base with the body", () => {
    const api = makeApi() as unknown as Api;
    const body = { name: "n", targetUrl: "https://h", eventTypes: ["e"] };
    createWebhook(api, body);
    expect(api.post).toHaveBeenCalledWith("/api/v1/admin/webhooks/", body);
  });

  it("updateWebhook PUTs /{id} (no trailing slash) with the body", () => {
    const api = makeApi() as unknown as Api;
    const body = { name: "n", targetUrl: "https://h", eventTypes: ["e"] };
    updateWebhook(api, "5", body);
    expect(api.put).toHaveBeenCalledWith("/api/v1/admin/webhooks/5", body);
  });

  it("toggleWebhook POSTs /{id}/disable and /{id}/enable with {}", () => {
    const api = makeApi() as unknown as Api;
    toggleWebhook(api, "1", "disable");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/admin/webhooks/1/disable",
      {}
    );
    toggleWebhook(api, "2", "enable");
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/admin/webhooks/2/enable",
      {}
    );
  });

  it("deleteWebhook DELETEs /{id} (no trailing slash)", () => {
    const api = makeApi() as unknown as Api;
    deleteWebhook(api, "1");
    expect(api.delete).toHaveBeenCalledWith("/api/v1/admin/webhooks/1");
  });
});

describe("webhook-deliveries keys + endpoint", () => {
  it("exposes a page-keyed list key", () => {
    expect(webhookDeliveriesKeys.all).toEqual(["admin-webhook-deliveries"]);
    expect(webhookDeliveriesKeys.list(2)).toEqual([
      "admin-webhook-deliveries",
      "list",
      2,
    ]);
  });

  it("fetchWebhookDeliveries GETs /?page=<n>&pageSize=20 (trailing slash before query)", () => {
    const api = makeApi() as unknown as Api;
    fetchWebhookDeliveries(api, 1);
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/admin/webhook-deliveries/?page=1&pageSize=20"
    );
    fetchWebhookDeliveries(api, 3);
    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/admin/webhook-deliveries/?page=3&pageSize=20"
    );
  });
});

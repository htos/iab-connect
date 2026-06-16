// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E25-S3: the email-campaigns slice api owns the query-key factory and BUILDS the
 * transport on the `useApiClient` contract (DEC-1 = A — there was no `@/lib` client
 * to wrap; the god-pages fetched inline). These assert the key shapes and that each
 * function calls the right api-client method with a BYTE-IDENTICAL endpoint / body
 * (verified against the god-page inline fetches), plus the folded
 * `fetchActiveMemberSegments` (`/api/v1/member-segments/active`, degrading to `[]`).
 */

import {
  EMAIL_CAMPAIGNS_BASE,
  emailCampaignsKeys,
  fetchEmailCampaigns,
  getEmailCampaign,
  getCampaignStatistics,
  getCampaignRecipients,
  createEmailCampaign,
  updateEmailCampaign,
  deleteEmailCampaign,
  sendTestEmail,
  scheduleCampaign,
  sendCampaign,
  cancelCampaign,
  resendCampaign,
  fetchActiveMemberSegments,
  type ListEmailCampaignsFilters,
} from "./email-campaigns-api";

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

const baseFilters: ListEmailCampaignsFilters = { page: 1, pageSize: 10 };

afterEach(() => vi.clearAllMocks());

describe("emailCampaignsKeys", () => {
  it("exposes the stable key shapes", () => {
    expect(emailCampaignsKeys.all).toEqual(["email-campaigns"]);
    expect(emailCampaignsKeys.detail("c1")).toEqual([
      "email-campaigns",
      "detail",
      "c1",
    ]);
    expect(emailCampaignsKeys.statistics("c1")).toEqual([
      "email-campaigns",
      "statistics",
      "c1",
    ]);
    expect(emailCampaignsKeys.recipients("c1")).toEqual([
      "email-campaigns",
      "recipients",
      "c1",
    ]);
    expect(emailCampaignsKeys.list(baseFilters)).toEqual([
      "email-campaigns",
      "list",
      { page: 1, pageSize: 10 },
    ]);
  });

  it("includes every filter field in the list key (refetch-on-filter)", () => {
    expect(
      emailCampaignsKeys.list({ page: 2, pageSize: 10, status: "Sent" })
    ).toEqual([
      "email-campaigns",
      "list",
      { page: 2, pageSize: 10, status: "Sent" },
    ]);
  });
});

describe("list / read endpoints (byte-identical to the god-pages)", () => {
  it("fetchEmailCampaigns GETs page=1&pageSize=10 and omits status when empty", () => {
    const api = makeApi() as unknown as Api;
    fetchEmailCampaigns(api, baseFilters);
    expect(api.get).toHaveBeenCalledWith(
      `${EMAIL_CAMPAIGNS_BASE}?page=1&pageSize=10`
    );
  });

  it("fetchEmailCampaigns appends status when set", () => {
    const api = makeApi() as unknown as Api;
    fetchEmailCampaigns(api, { page: 2, pageSize: 10, status: "Sent" });
    expect(api.get).toHaveBeenCalledWith(
      `${EMAIL_CAMPAIGNS_BASE}?page=2&pageSize=10&status=Sent`
    );
  });

  it("getEmailCampaign GETs /{id}", () => {
    const api = makeApi() as unknown as Api;
    getEmailCampaign(api, "c1");
    expect(api.get).toHaveBeenCalledWith(`${EMAIL_CAMPAIGNS_BASE}/c1`);
  });

  it("getCampaignStatistics GETs /{id}/statistics", () => {
    const api = makeApi() as unknown as Api;
    getCampaignStatistics(api, "c1");
    expect(api.get).toHaveBeenCalledWith(
      `${EMAIL_CAMPAIGNS_BASE}/c1/statistics`
    );
  });

  it("getCampaignRecipients GETs /{id}/recipients?page=1&pageSize=100", () => {
    const api = makeApi() as unknown as Api;
    getCampaignRecipients(api, "c1");
    expect(api.get).toHaveBeenCalledWith(
      `${EMAIL_CAMPAIGNS_BASE}/c1/recipients?page=1&pageSize=100`
    );
  });
});

describe("write + action endpoints (byte-identical to the god-pages)", () => {
  it("createEmailCampaign POSTs the base with the body", () => {
    const api = makeApi() as unknown as Api;
    const body = { name: "x" } as never;
    createEmailCampaign(api, body);
    expect(api.post).toHaveBeenCalledWith(EMAIL_CAMPAIGNS_BASE, body);
  });

  it("updateEmailCampaign PUTs /{id} with the body", () => {
    const api = makeApi() as unknown as Api;
    const body = { name: "x" } as never;
    updateEmailCampaign(api, "c1", body);
    expect(api.put).toHaveBeenCalledWith(`${EMAIL_CAMPAIGNS_BASE}/c1`, body);
  });

  it("deleteEmailCampaign DELETEs /{id}", () => {
    const api = makeApi() as unknown as Api;
    deleteEmailCampaign(api, "c1");
    expect(api.delete).toHaveBeenCalledWith(`${EMAIL_CAMPAIGNS_BASE}/c1`);
  });

  it("sendTestEmail POSTs /{id}/test with { testEmail }", () => {
    const api = makeApi() as unknown as Api;
    sendTestEmail(api, "c1", { testEmail: "t@e.org" });
    expect(api.post).toHaveBeenCalledWith(`${EMAIL_CAMPAIGNS_BASE}/c1/test`, {
      testEmail: "t@e.org",
    });
  });

  it("scheduleCampaign POSTs /{id}/schedule with { scheduledAt }", () => {
    const api = makeApi() as unknown as Api;
    scheduleCampaign(api, "c1", { scheduledAt: "2026-06-01T00:00:00.000Z" });
    expect(api.post).toHaveBeenCalledWith(
      `${EMAIL_CAMPAIGNS_BASE}/c1/schedule`,
      { scheduledAt: "2026-06-01T00:00:00.000Z" }
    );
  });

  it("sendCampaign POSTs /{id}/send", () => {
    const api = makeApi() as unknown as Api;
    sendCampaign(api, "c1");
    expect(api.post).toHaveBeenCalledWith(
      `${EMAIL_CAMPAIGNS_BASE}/c1/send`,
      undefined
    );
  });

  it("cancelCampaign POSTs /{id}/cancel", () => {
    const api = makeApi() as unknown as Api;
    cancelCampaign(api, "c1");
    expect(api.post).toHaveBeenCalledWith(
      `${EMAIL_CAMPAIGNS_BASE}/c1/cancel`,
      undefined
    );
  });

  it("resendCampaign POSTs /{id}/resend for all, /{id}/resend-failed for failed-only", () => {
    const api = makeApi() as unknown as Api;
    resendCampaign(api, "c1", false);
    expect(api.post).toHaveBeenCalledWith(
      `${EMAIL_CAMPAIGNS_BASE}/c1/resend`,
      undefined
    );
    resendCampaign(api, "c1", true);
    expect(api.post).toHaveBeenCalledWith(
      `${EMAIL_CAMPAIGNS_BASE}/c1/resend-failed`,
      undefined
    );
  });
});

describe("fetchActiveMemberSegments (folded inline god-page fetch)", () => {
  it("GETs /api/v1/member-segments/active and returns the array", async () => {
    const api = makeApi() as unknown as Api;
    api.get = vi.fn(() =>
      Promise.resolve({
        data: [{ id: "s1", name: "VIP", segmentType: "Dynamic" }],
        error: null,
        status: 200,
      })
    ) as never;
    const result = await fetchActiveMemberSegments(api);
    expect(api.get).toHaveBeenCalledWith("/api/v1/member-segments/active");
    expect(result).toEqual([{ id: "s1", name: "VIP", segmentType: "Dynamic" }]);
  });

  it("degrades to [] on error", async () => {
    const api = makeApi() as unknown as Api;
    api.get = vi.fn(() =>
      Promise.resolve({ data: null, error: "boom", status: 500 })
    ) as never;
    expect(await fetchActiveMemberSegments(api)).toEqual([]);
  });
});

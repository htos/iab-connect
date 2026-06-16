// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

/**
 * E28-S1 characterization net — public sponsors page — ADAPTED to RSC in S2
 * (A88/A79). The page flipped client→async Server Component; this spec's render
 * harness adapts `render(<Page/>)` → `render(await Page())` + mocks
 * `next-intl/server` `getTranslations` (was `next-intl` `useTranslations`). The
 * BEHAVIOURAL assertions are UNCHANGED: error (no retry) / empty, tier grouping +
 * hardcoded German `TIER_LABELS.de` headings + `getHighestTier`, the /public/
 * contact CTA, the hardcoded "Website" link, independence from `features/sponsors/`.
 *
 * Principal A79 delta: the client loading-spinner test is removed — an RSC has no
 * client "loading" state for the initial fetch (the page awaits the server fetch
 * before rendering). The error/empty COPY is pinned identically below.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (_ns?: string) => (k: string) => k,
}));

import PublicSponsorsPage from "./page";

type Sponsor = {
  id: string;
  companyName: string;
  contactPerson?: string;
  website?: string;
  description?: string;
  packages: { name: string; tier: string }[];
};

function stubFetch(sponsors: Sponsor[], ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (_url?: unknown) =>
        ({ ok, json: async () => sponsors }) as unknown as Response
    )
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PublicSponsorsPage (E28-S1 characterization, RSC-adapted)", () => {
  it("fetches the public sponsors from /api/v1/sponsors/public", async () => {
    const fetchMock = vi.fn(
      async (_url?: unknown) =>
        ({ ok: true, json: async () => [] }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);
    render(await PublicSponsorsPage());
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/v1/sponsors/public"
    );
  });

  it("renders the error message with NO retry button on fetch failure", async () => {
    stubFetch([], false);
    render(await PublicSponsorsPage());
    expect(screen.getByText("errorMessage")).toBeInTheDocument();
    expect(screen.queryByText("retry")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders the empty copy when there are no sponsors", async () => {
    stubFetch([]);
    render(await PublicSponsorsPage());
    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("groups a sponsor under the hardcoded German tier heading (Silber, not Silver)", async () => {
    stubFetch([
      {
        id: "s1",
        companyName: "SilberCo",
        packages: [{ name: "P", tier: "Silber" }],
      },
    ]);
    render(await PublicSponsorsPage());
    expect(screen.getByText("SilberCo")).toBeInTheDocument();
    expect(screen.getByText("Silber")).toBeInTheDocument();
    expect(screen.queryByText("Silver")).toBeNull();
  });

  it("selects the highest tier when a sponsor has multiple packages (getHighestTier)", async () => {
    stubFetch([
      {
        id: "s1",
        companyName: "MultiCo",
        packages: [
          { name: "low", tier: "Bronze" },
          { name: "high", tier: "Gold" },
        ],
      },
    ]);
    render(await PublicSponsorsPage());
    // Highest tier Gold wins → only the Gold heading appears, not Bronze.
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.queryByText("Bronze")).toBeNull();
  });

  it("renders sponsors with no packages under the partners section", async () => {
    stubFetch([{ id: "p1", companyName: "PartnerCo", packages: [] }]);
    render(await PublicSponsorsPage());
    expect(screen.getByText("PartnerCo")).toBeInTheDocument();
    expect(screen.getByText("partnerTitle")).toBeInTheDocument();
  });

  it("renders the hardcoded 'Website' external link for a sponsor with a website", async () => {
    stubFetch([
      {
        id: "s1",
        companyName: "WebCo",
        website: "https://webco.example.com",
        packages: [{ name: "P", tier: "Gold" }],
      },
    ]);
    render(await PublicSponsorsPage());
    const link = screen.getByText("Website");
    expect(link.closest("a")?.getAttribute("href")).toBe(
      "https://webco.example.com"
    );
  });

  it("renders the /public/contact CTA button", async () => {
    stubFetch([]);
    render(await PublicSponsorsPage());
    const cta = screen.getByRole("link", { name: "ctaButton" });
    expect(cta.getAttribute("href")).toBe("/public/contact");
  });
});

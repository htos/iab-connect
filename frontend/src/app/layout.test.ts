import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// REQ-086 (E9-S2) AC-3: generateMetadata() fetches the configured organization
// server-side and falls back to a neutral title/description on fetch failure.

// Inter() runs at module load; stub the font so the import doesn't hit the network.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter" }),
}));
vi.mock("./providers", () => ({ Providers: () => null }));
vi.mock("@/components/navigation", () => ({ MainLayout: () => null }));
vi.mock("next-intl", () => ({ NextIntlClientProvider: () => null }));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(),
  getMessages: vi.fn(),
}));

import { generateMetadata } from "./layout";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.clearAllMocks();
});

describe("generateMetadata (REQ-086 E9-S2)", () => {
  it("returns the configured organization name + description", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        applicationName: "Acme Verein",
        description: "An association for everyone",
      }),
    }) as unknown as typeof fetch;

    const metadata = await generateMetadata();

    expect(metadata.title).toBe("Acme Verein");
    expect(metadata.description).toBe("An association for everyone");
  });

  it("falls back to a neutral title when the fetch fails", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const metadata = await generateMetadata();

    expect(metadata.title).toBe("Organization Connect");
    expect(metadata.title).not.toContain("IAB");
  });

  it("falls back when the endpoint returns a non-OK status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const metadata = await generateMetadata();

    expect(metadata.title).toBe("Organization Connect");
  });
});

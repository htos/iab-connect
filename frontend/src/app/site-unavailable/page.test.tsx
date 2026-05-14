// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// REQ-087 (E10-S5): next-intl identity translations so assertions can match on the key.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import SiteUnavailablePage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SiteUnavailablePage", () => {
  it("always renders the neutral message and a focused member-login link", async () => {
    // Settings fetch never resolves here — the core message must still render.
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<SiteUnavailablePage />);

    expect(
      screen.getByRole("heading", { name: "heading" })
    ).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();

    const login = screen.getByRole("link", { name: "memberLogin" });
    expect(login).toHaveAttribute("href", "/login");
    expect(login).toHaveFocus();
  });

  it("renders organization branding when the settings fetch succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          applicationName: "Acme Society",
          logoUrl: null,
          logoText: "AS",
          logoBackgroundColor: "#000000",
          logoTextColor: "#FFFFFF",
        }),
      })
    );

    render(<SiteUnavailablePage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Society")).toBeInTheDocument();
    });
  });

  it("falls back to a plain unbranded message when the settings fetch fails (never errors)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );

    render(<SiteUnavailablePage />);

    // Core message still renders; no org name appears.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "heading" })
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Acme Society")).not.toBeInTheDocument();
  });
});

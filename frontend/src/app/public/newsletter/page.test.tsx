// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

/**
 * E28-S1 characterization net — public newsletter page (`newsletter/page.tsx`).
 *
 * Pins the subscribe/unsubscribe tab toggle + per-tab reset; the load-bearing
 * `firstName || undefined` / `lastName || undefined` coercion (empty names must
 * stay OUT of the call so `JSON.stringify` drops them); the unsubscribe `{email}`
 * call; per-tab success/error panels + loading label swaps. These pins gate the
 * S3 RHF+Zod migration (the page stays a client island).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next-intl", () => {
  const translate = (k: string, vars?: Record<string, unknown>) =>
    vars ? `${k} ${JSON.stringify(vars)}` : k;
  return { useTranslations: () => translate };
});

vi.mock("@/components/providers/AppSettingsProvider", () => ({
  useAppSettings: () => ({ settings: { applicationName: "Test Org Name" } }),
}));

vi.mock("@/features/public/api/public-forms-api", () => ({
  subscribeNewsletter: vi.fn(),
  unsubscribeByEmail: vi.fn(),
}));

import PublicNewsletterPage from "./page";
import { subscribeNewsletter, unsubscribeByEmail } from "@/features/public/api/public-forms-api";

const mockSubscribe = vi.mocked(subscribeNewsletter);
const mockUnsub = vi.mocked(unsubscribeByEmail);

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockSubscribe.mockResolvedValue({ success: true, message: "ok" });
  mockUnsub.mockResolvedValue({ success: true, email: "x", message: "ok" });
});

describe("PublicNewsletterPage (E28-S1 characterization)", () => {
  it("interpolates applicationName into the subscribe description", () => {
    render(<PublicNewsletterPage />);
    expect(screen.getByText(/Test Org Name/)).toBeInTheDocument();
  });

  it("resets the form when switching tabs", () => {
    render(<PublicNewsletterPage />);
    fireEvent.change(screen.getByLabelText(/emailLabel/), {
      target: { value: "keep@me.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "unsubscribeTitle" }));
    // The unsubscribe tab's email field is empty after the reset.
    expect(
      (screen.getByLabelText(/emailLabel/) as HTMLInputElement).value
    ).toBe("");
  });

  it("subscribe: drops empty first/last names via || undefined", async () => {
    render(<PublicNewsletterPage />);
    fireEvent.change(screen.getByLabelText(/emailLabel/), {
      target: { value: "sub@me.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "subscribeButton" }));

    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    expect(mockSubscribe).toHaveBeenCalledWith(
      "sub@me.com",
      undefined,
      undefined
    );
  });

  it("subscribe: forwards filled first/last names", async () => {
    render(<PublicNewsletterPage />);
    fireEvent.change(screen.getByLabelText(/emailLabel/), {
      target: { value: "sub@me.com" },
    });
    fireEvent.change(screen.getByLabelText(/firstNameLabel/), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/lastNameLabel/), {
      target: { value: "Doe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "subscribeButton" }));

    await waitFor(() =>
      expect(mockSubscribe).toHaveBeenCalledWith("sub@me.com", "John", "Doe")
    );
  });

  it("subscribe: shows the success panel on success", async () => {
    render(<PublicNewsletterPage />);
    fireEvent.change(screen.getByLabelText(/emailLabel/), {
      target: { value: "sub@me.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "subscribeButton" }));
    await waitFor(() =>
      expect(screen.getByText("subscribeSuccess")).toBeInTheDocument()
    );
  });

  it("subscribe: shows the per-tab error banner on failure", async () => {
    mockSubscribe.mockRejectedValueOnce(new Error("boom"));
    render(<PublicNewsletterPage />);
    fireEvent.change(screen.getByLabelText(/emailLabel/), {
      target: { value: "sub@me.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "subscribeButton" }));
    await waitFor(() =>
      expect(screen.getByText("subscribeError")).toBeInTheDocument()
    );
  });

  it("subscribe: swaps the button label to 'subscribing' while in flight", async () => {
    mockSubscribe.mockReturnValueOnce(new Promise(() => {}));
    render(<PublicNewsletterPage />);
    fireEvent.change(screen.getByLabelText(/emailLabel/), {
      target: { value: "sub@me.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "subscribeButton" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "subscribing" })).toBeDisabled()
    );
  });

  it("unsubscribe: calls unsubscribeByEmail({email}) and shows success", async () => {
    render(<PublicNewsletterPage />);
    fireEvent.click(screen.getByRole("button", { name: "unsubscribeTitle" }));
    fireEvent.change(screen.getByLabelText(/emailLabel/), {
      target: { value: "bye@me.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "unsubscribeButton" }));

    await waitFor(() => expect(mockUnsub).toHaveBeenCalledWith("bye@me.com"));
    expect(screen.getByText("unsubscribeSuccess")).toBeInTheDocument();
  });

  it("unsubscribe: shows the per-tab error banner on failure", async () => {
    mockUnsub.mockRejectedValueOnce(new Error("boom"));
    render(<PublicNewsletterPage />);
    fireEvent.click(screen.getByRole("button", { name: "unsubscribeTitle" }));
    fireEvent.change(screen.getByLabelText(/emailLabel/), {
      target: { value: "bye@me.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "unsubscribeButton" }));
    await waitFor(() =>
      expect(screen.getByText("unsubscribeError")).toBeInTheDocument()
    );
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

/**
 * E28-S1 characterization net — public contact page (`contact/page.tsx`).
 *
 * Pins the single most fragile public behaviour: the HONEYPOT silent-success
 * short-circuit — `if (website) { setStatus("success"); return; }` runs BEFORE
 * the fetch, on the raw value, and `website` STAYS in the POST payload. Also
 * pins the idle→loading→success "send another" swap, the error banner + submit-
 * label swap (sending/retry/submit), the exact subject option set, the
 * `{name,email,subject,message,website}` payload, and the applicationName
 * sidebar line. These pins gate the S3 RHF+Zod migration (the page stays client).
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
  const translate = (k: string) => k;
  return { useTranslations: () => translate };
});

vi.mock("@/components/providers/AppSettingsProvider", () => ({
  useAppSettings: () => ({ settings: { applicationName: "Test Org Name" } }),
}));

import PublicContactPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
});

function fillRequired() {
  fireEvent.change(screen.getByLabelText(/nameLabel/), {
    target: { value: "Alice" },
  });
  fireEvent.change(screen.getByLabelText(/emailLabel/), {
    target: { value: "alice@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/subjectLabel/), {
    target: { value: "general" },
  });
  fireEvent.change(screen.getByLabelText(/messageLabel/), {
    target: { value: "Hello there" },
  });
}

describe("PublicContactPage (E28-S1 characterization)", () => {
  it("renders the exact subject option set in order, placeholder disabled", () => {
    render(<PublicContactPage />);
    const select = screen.getByLabelText(/subjectLabel/) as HTMLSelectElement;
    const opts = Array.from(select.querySelectorAll("option"));
    expect(opts.map((o) => o.value)).toEqual([
      "",
      "general",
      "membership",
      "events",
      "sponsoring",
      "other",
    ]);
    expect(opts[0].disabled).toBe(true);
  });

  it("renders the applicationName from app settings in the sidebar", () => {
    render(<PublicContactPage />);
    expect(screen.getByText(/Test Org Name/)).toBeInTheDocument();
  });

  it("honeypot: a filled website silently shows success WITHOUT calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicContactPage />);

    fillRequired();
    fireEvent.change(screen.getByLabelText("Website"), {
      target: { value: "i-am-a-bot" },
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() =>
      expect(screen.getByText("successTitle")).toBeInTheDocument()
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits successfully and swaps to the 'send another' panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true }) as unknown as Response)
    );
    render(<PublicContactPage />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() =>
      expect(screen.getByText("successTitle")).toBeInTheDocument()
    );
    expect(
      screen.getByRole("button", { name: "sendAnother" })
    ).toBeInTheDocument();
  });

  it("swaps the submit label to 'sending' while the request is in flight", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {}))
    );
    render(<PublicContactPage />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "sending" })).toBeDisabled()
    );
  });

  it("shows the error banner and swaps the submit label to 'retry' on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false }) as unknown as Response)
    );
    render(<PublicContactPage />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() =>
      expect(screen.getByText("errorMessage")).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
  });

  it("POSTs {name,email,subject,message,website} to /api/v1/public/contact", async () => {
    const fetchMock = vi.fn(
      async (_url?: string, _init?: RequestInit) =>
        ({ ok: true }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicContactPage />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/public/contact");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Alice",
      email: "alice@example.com",
      subject: "general",
      message: "Hello there",
      website: "",
    });
  });
});

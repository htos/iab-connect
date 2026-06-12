// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

/**
 * E28-S1 characterization net — public unsubscribe-by-token page
 * (`unsubscribe/[token]/page.tsx`).
 *
 * A `[token]`-param-driven confirm STATE MACHINE (NOT an RHF form — S3-DEC-5):
 * verifyUnsubscribe(token) on mount → confirm vs already; confirmUnsubscribe(token)
 * → success. Pins all five PageState renders (loading/confirm/already/success/
 * error) with their i18n keys and the error precedence (invalidToken / err.message
 * / error). NO redirect / NO auth check (middleware exempts the route).
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

const hoisted = vi.hoisted(() => ({ token: "tok-1" as string | undefined }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: hoisted.token }),
}));

vi.mock("next-intl", () => {
  const translate = (k: string, vars?: Record<string, unknown>) =>
    vars ? `${k} ${JSON.stringify(vars)}` : k;
  return { useTranslations: () => translate };
});

vi.mock("@/lib/api/privacy", () => ({
  verifyUnsubscribe: vi.fn(),
  confirmUnsubscribe: vi.fn(),
}));

import UnsubscribePage from "./page";
import { verifyUnsubscribe, confirmUnsubscribe } from "@/lib/api/privacy";

const mockVerify = vi.mocked(verifyUnsubscribe);
const mockConfirm = vi.mocked(confirmUnsubscribe);

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.token = "tok-1";
});

describe("UnsubscribePage (E28-S1 characterization)", () => {
  it("renders the loading state until verify resolves", () => {
    mockVerify.mockReturnValueOnce(new Promise(() => {}));
    render(<UnsubscribePage />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("verifies the token on mount and renders the confirm state with the email", async () => {
    mockVerify.mockResolvedValueOnce({
      alreadyUnsubscribed: false,
      email: "a@b.com",
    });
    render(<UnsubscribePage />);
    await waitFor(() =>
      expect(screen.getByText("confirmTitle")).toBeInTheDocument()
    );
    expect(mockVerify).toHaveBeenCalledWith("tok-1");
    expect(screen.getByText(/a@b\.com/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "confirmButton" })
    ).toBeInTheDocument();
  });

  it("renders the already-unsubscribed state when verify reports it", async () => {
    mockVerify.mockResolvedValueOnce({
      alreadyUnsubscribed: true,
      email: "a@b.com",
    });
    render(<UnsubscribePage />);
    await waitFor(() =>
      expect(screen.getByText("alreadyUnsubscribed")).toBeInTheDocument()
    );
  });

  it("confirms the unsubscribe and renders the success state", async () => {
    mockVerify.mockResolvedValueOnce({
      alreadyUnsubscribed: false,
      email: "a@b.com",
    });
    mockConfirm.mockResolvedValueOnce({
      success: true,
      email: "a@b.com",
      message: "ok",
    });
    render(<UnsubscribePage />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "confirmButton" })
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "confirmButton" }));
    await waitFor(() =>
      expect(screen.getByText("successText")).toBeInTheDocument()
    );
    expect(mockConfirm).toHaveBeenCalledWith("tok-1");
  });

  it("renders the error state with err.message when verify rejects", async () => {
    mockVerify.mockRejectedValueOnce(new Error("Token expired"));
    render(<UnsubscribePage />);
    await waitFor(() =>
      expect(screen.getByText("Token expired")).toBeInTheDocument()
    );
  });

  it("renders the error state with the generic 'error' key when confirm rejects", async () => {
    mockVerify.mockResolvedValueOnce({
      alreadyUnsubscribed: false,
      email: "a@b.com",
    });
    mockConfirm.mockRejectedValueOnce(new Error("nope"));
    render(<UnsubscribePage />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "confirmButton" })
      ).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "confirmButton" }));
    await waitFor(() => expect(screen.getByText("error")).toBeInTheDocument());
  });

  it("renders invalidToken and never calls verify when the token is missing", async () => {
    hoisted.token = undefined;
    render(<UnsubscribePage />);
    await waitFor(() =>
      expect(screen.getByText("invalidToken")).toBeInTheDocument()
    );
    expect(mockVerify).not.toHaveBeenCalled();
  });
});

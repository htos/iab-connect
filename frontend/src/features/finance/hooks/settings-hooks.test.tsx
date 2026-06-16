// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * E26-S6 focused hook tests: the profile POST-vs-PUT 404 branch + the
 * `finance-profile-changed` dispatch, the tax-code rate ×100/÷100 round-trip, and a
 * mutation-invalidation (save-tax-code → invalidates the tax-codes key). All BUILD on the
 * `useApiClient` mock (A94).
 */

const apiSpy = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  useApiClient: () => apiSpy,
  useAuth: () => ({ accessToken: "tok" }),
}));

import {
  useFinanceProfile,
  useSaveFinanceProfile,
} from "./use-finance-profile";
import {
  taxCodeFormToPayload,
  useSaveTaxCode,
  useTaxCodesQuery,
} from "./use-tax-codes-admin";
import { settingsKeys } from "../api/settings-api";
import type { FinanceProfilePayload } from "../types/settings.types";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const PAYLOAD: FinanceProfilePayload = {
  jurisdiction: "CH",
  countryCode: null,
  currency: "CHF",
  fiscalYearStartMonth: 1,
  organizationName: "Acme",
  organizationAddress: "Main 1",
  organizationCity: "Zurich",
  organizationPostalCode: "8000",
  organizationCountry: "CH",
  organizationEmail: null,
  organizationPhone: null,
  organizationWebsite: null,
  organizationUid: null,
  bankName: null,
  bankIban: null,
  bankBic: null,
  accountingMode: "SimpleCash",
};

beforeEach(() => {
  apiSpy.get.mockReset();
  apiSpy.post.mockReset();
  apiSpy.put.mockReset();
  apiSpy.delete.mockReset();
});

afterEach(cleanup);

describe("useFinanceProfile — 404 create-mode vs existing-profile branch", () => {
  it("maps a 404 GET to create mode (profile null, no loadError)", async () => {
    apiSpy.get.mockResolvedValue({
      data: null,
      error: "Not Found",
      status: 404,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFinanceProfile(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ profile: null, loadError: false });
  });

  it("maps a non-404 error to loadError", async () => {
    apiSpy.get.mockResolvedValue({ data: null, error: "boom", status: 500 });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFinanceProfile(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ profile: null, loadError: true });
  });

  it("returns the existing profile on a 200", async () => {
    apiSpy.get.mockResolvedValue({
      data: { id: "prof-1", accountingMode: "DoubleEntry" },
      error: null,
      status: 200,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFinanceProfile(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.profile?.id).toBe("prof-1");
    expect(result.current.data?.loadError).toBe(false);
  });

  it("does not fetch when disabled (A97 read-gate parity)", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useFinanceProfile(false), { wrapper });
    expect(apiSpy.get).not.toHaveBeenCalled();
  });
});

describe("useSaveFinanceProfile — POST (create) vs PUT (update) + event", () => {
  it("POSTs /profile when profileId is null and dispatches finance-profile-changed", async () => {
    const eventSpy = vi.fn();
    window.addEventListener("finance-profile-changed", eventSpy);
    try {
      apiSpy.post.mockResolvedValue({
        data: { id: "new-1" },
        error: null,
        status: 200,
      });
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useSaveFinanceProfile(), { wrapper });

      result.current.mutate({ profileId: null, payload: PAYLOAD });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiSpy.post).toHaveBeenCalledWith(
        "/api/v1/finance/profile",
        PAYLOAD
      );
      expect(apiSpy.put).not.toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalled();
    } finally {
      window.removeEventListener("finance-profile-changed", eventSpy);
    }
  });

  it("PUTs /profile/{id} when profileId is set", async () => {
    apiSpy.put.mockResolvedValue({
      data: { id: "prof-1" },
      error: null,
      status: 200,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaveFinanceProfile(), { wrapper });

    result.current.mutate({ profileId: "prof-1", payload: PAYLOAD });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.put).toHaveBeenCalledWith(
      "/api/v1/finance/profile/prof-1",
      PAYLOAD
    );
    expect(apiSpy.post).not.toHaveBeenCalled();
  });

  it("does NOT dispatch the event when the save fails", async () => {
    const eventSpy = vi.fn();
    window.addEventListener("finance-profile-changed", eventSpy);
    try {
      apiSpy.put.mockResolvedValue({ data: null, error: "boom", status: 500 });
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useSaveFinanceProfile(), { wrapper });

      result.current.mutate({ profileId: "prof-1", payload: PAYLOAD });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(eventSpy).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("finance-profile-changed", eventSpy);
    }
  });
});

describe("taxCodeFormToPayload — rate ×100/÷100 round-trip (load-bearing)", () => {
  it("divides the human percentage by 100 for the wire (7.7 → 0.077)", () => {
    expect(
      taxCodeFormToPayload({
        code: "VAT-STD",
        label: "Standard VAT",
        rate: 7.7,
        isDefault: true,
      })
    ).toEqual({
      code: "VAT-STD",
      label: "Standard VAT",
      rate: 0.077,
      isDefault: true,
    });
  });

  it("round-trips a no-touch edit (stored 0.077 → form 7.7 → wire 0.077)", () => {
    const storedFraction = 0.077;
    const formPercentage = storedFraction * 100; // what openEdit loads
    const payload = taxCodeFormToPayload({
      code: "VAT-STD",
      label: "Standard VAT",
      rate: formPercentage,
      isDefault: true,
    });
    expect(payload.rate).toBeCloseTo(0.077, 10);
  });
});

describe("useTaxCodesQuery + useSaveTaxCode", () => {
  it("reads the {items} envelope", async () => {
    apiSpy.get.mockResolvedValue({
      data: { items: [{ id: "t1", code: "VAT", rate: 0.077 }] },
      error: null,
      status: 200,
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTaxCodesQuery(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].code).toBe("VAT");
  });

  it("save invalidates the tax-codes key and submits rate÷100", async () => {
    apiSpy.post.mockResolvedValue({ data: {}, error: null, status: 200 });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSaveTaxCode(), { wrapper });

    result.current.mutate({
      id: null,
      values: {
        code: "VAT-RED",
        label: "Reduced",
        rate: 8.1,
        isDefault: false,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.post).toHaveBeenCalledWith(
      "/api/v1/finance/tax-codes",
      expect.objectContaining({ rate: 0.081, code: "VAT-RED" })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: settingsKeys.taxCodes(),
    });
  });
});

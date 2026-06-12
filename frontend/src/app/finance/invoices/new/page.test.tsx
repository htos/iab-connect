// @vitest-environment jsdom
//
// E26-S1 (S3) characterization net — invoices/NEW page (create form).
//
// A56 note: GUARD = write-gated page. Reads canWriteFinance ONLY (no isAuthenticated /
//   authLoading). useEffect -> router.replace("/finance/invoices") when !canWriteFinance;
//   render-time `if (!canWriteFinance) return null`. CONFIRMED.
// A79 deltas:
//   - A95: `recipientType` state union is "Member" | "Other". The <select> renders/POSTs
//     the literal "Other" (option value="Other"), while the canonical @/types/finance
//     RecipientType + list/detail pages use "External". A no-touch round-trip assertion
//     pins that selecting "Other" round-trips "Other" into the POST body. MUST be preserved
//     by the S3 RHF+Zod migration (Zod field = full transport union, NOT z.enum subset).
//   - A96: no field is .trim()ed before POST. recipientName/recipientAddress sent as typed.
//   - Lookups: GET /tax-codes, /activity-areas, and /members?pageSize=500 (members only
//     when recipientType==="Member"). taxCodes/activityAreas filtered to isActive client-side.
//   - On create success: POST /invoices -> router.push(/finance/invoices/{createdId});
//     saveAndSend additionally POSTs /invoices/{id}/send before navigating.
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
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/finance/invoices/new",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href?: string;
  }) => <a href={typeof href === "string" ? href : "#"}>{children}</a>,
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
const apiUpload = vi.fn();
const authState = {
  isAuthenticated: true,
  isLoading: false,
  canReadFinance: true,
  canWriteFinance: true,
  isAdmin: true,
  isVorstand: true,
  isKassier: true,
  isAuditor: false,
  user: { name: "Kassier", email: "kassier@example.org" },
  accessToken: "tok",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => ({
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
    upload: apiUpload,
  }),
}));

import Page from "./page";

const members = [
  { id: "m1", firstName: "Alice", lastName: "Acme" },
  { id: "m2", firstName: "Bob", lastName: "Builder" },
];
const taxCodes = [
  {
    id: "tc1",
    code: "STD",
    label: "Standard",
    rate: 8.1,
    isDefault: true,
    isActive: true,
  },
  {
    id: "tc2",
    code: "OLD",
    label: "Inactive",
    rate: 7.7,
    isDefault: false,
    isActive: false,
  },
];
const activityAreas = [
  { id: "aa1", name: "Events", code: "EVT", isActive: true, sortOrder: 1 },
  { id: "aa2", name: "Gone", code: "GONE", isActive: false, sortOrder: 2 },
];

function routeGet(url: string) {
  if (url.startsWith("/api/v1/finance/tax-codes")) {
    return Promise.resolve({
      data: { items: taxCodes },
      error: null,
      status: 200,
    });
  }
  if (url.startsWith("/api/v1/finance/activity-areas")) {
    return Promise.resolve({
      data: { items: activityAreas },
      error: null,
      status: 200,
    });
  }
  if (url.startsWith("/api/v1/members")) {
    return Promise.resolve({
      data: { items: members, totalCount: members.length },
      error: null,
      status: 200,
    });
  }
  return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
}

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();
  apiGet.mockImplementation((url: string) => routeGet(url));
  apiPost.mockResolvedValue({
    data: { id: "created-1" },
    error: null,
    status: 200,
  });
  apiPut.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 200 });
  apiUpload.mockResolvedValue({ data: {}, error: null, status: 200 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.assign(authState, {
    isAuthenticated: true,
    isLoading: false,
    canReadFinance: true,
    canWriteFinance: true,
    isAdmin: true,
    isVorstand: true,
    isKassier: true,
    isAuditor: false,
  });
});

describe("invoices/new — write guard", () => {
  it("replaces to /finance/invoices and renders null when !canWriteFinance", async () => {
    authState.canWriteFinance = false;
    render(<Page />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/finance/invoices")
    );
    expect(screen.queryByText("newInvoice")).not.toBeInTheDocument();
  });
});

describe("invoices/new — lookups", () => {
  it("GETs tax-codes, activity-areas and members (members default because recipientType=Member)", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/tax-codes")
    );
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/activity-areas");
    expect(apiGet).toHaveBeenCalledWith("/api/v1/members?pageSize=500");
  });

  it("only renders active tax codes and active activity areas in the line-item selects", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("Standard (8.1%)")).toBeInTheDocument()
    );
    // Inactive tax code is filtered out.
    expect(screen.queryByText("Inactive (7.7%)")).not.toBeInTheDocument();
    // Active area present, inactive absent.
    expect(screen.getByRole("option", { name: "EVT" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "GONE" })
    ).not.toBeInTheDocument();
  });
});

describe("invoices/new — A95 recipientType 'Other' round-trip", () => {
  it("renders the 'Other' option and round-trips the literal 'Other' into the POST body (NOT 'External')", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/tax-codes")
    );

    const typeSelect = screen.getByDisplayValue(
      "recipientTypeMember"
    ) as HTMLSelectElement;
    // The out-of-canonical option value is the literal "Other".
    const otherOption = typeSelect.querySelector(
      'option[value="Other"]'
    ) as HTMLOptionElement;
    expect(otherOption).toBeTruthy();

    fireEvent.change(typeSelect, { target: { value: "Other" } });
    // Now the external recipient fields show.
    fireEvent.change(screen.getByPlaceholderText("recipientNamePlaceholder"), {
      target: { value: "External Co" },
    });

    fireEvent.click(screen.getByText("saveAsDraft"));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/invoices",
        expect.objectContaining({ recipientType: "Other" })
      )
    );
    // Assert it is NOT normalised to the canonical "External".
    const body = apiPost.mock.calls.find(
      (c) => c[0] === "/api/v1/finance/invoices"
    )![1] as Record<string, unknown>;
    expect(body.recipientType).toBe("Other");
    expect(body.recipientType).not.toBe("External");
    // A96: recipientName sent untrimmed/as typed.
    expect(body.recipientName).toBe("External Co");
  });
});

describe("invoices/new — submit flows", () => {
  it("saveAsDraft POSTs /invoices then pushes to the created detail route", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/tax-codes")
    );
    fireEvent.click(screen.getByText("saveAsDraft"));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/invoices",
        expect.any(Object)
      )
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/finance/invoices/created-1")
    );
  });

  it("saveAndSend POSTs /invoices then POSTs /invoices/{id}/send before navigating", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/tax-codes")
    );
    fireEvent.click(screen.getByText("saveAndSend"));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/invoices/created-1/send",
        {}
      )
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/finance/invoices/created-1")
    );
  });

  it("shows errorCreatingInvoice and does NOT navigate when the POST fails", async () => {
    apiPost.mockResolvedValue({ data: null, error: "boom", status: 500 });
    render(<Page />);
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/tax-codes")
    );
    fireEvent.click(screen.getByText("saveAsDraft"));
    await waitFor(() =>
      expect(screen.getByText("errorCreatingInvoice")).toBeInTheDocument()
    );
    expect(push).not.toHaveBeenCalled();
  });
});

describe("invoices/new — line items (no field-level validation today)", () => {
  it("addItem appends a row; removeItem disabled when only one row", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/tax-codes")
    );
    const removeButtons = screen.getAllByTitle("removeItem");
    expect(removeButtons).toHaveLength(1);
    expect(removeButtons[0]).toBeDisabled();

    fireEvent.click(screen.getByText("addItem"));
    expect(screen.getAllByTitle("removeItem")).toHaveLength(2);
  });
});

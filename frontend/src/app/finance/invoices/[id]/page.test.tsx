// @vitest-environment jsdom
//
// E26-S1 (S3) characterization net — invoices/[id] DETAIL page.
//
// A56 note: GUARD = canReadFinance ONLY (no isAuthenticated / authLoading). useEffect ->
//   router.replace("/finance"); render-time `if (!canReadFinance) return null`. CONFIRMED.
//   The page reads the id via useParams<{id}>() (NOT use(params)) — so the test mocks
//   useParams to return { id: "inv-1" }.
// A79 deltas:
//   - A99: this is the ONLY real detail route. No not-found sentinel — a load failure
//     renders a generic full-page red error card (errorLoadingInvoice). The one
//     status-specific branch is e-invoice 409 (+ message includes "finance profile")
//     -> noProfileError amber panel (financeErrors.noFinanceProfile). Pinned both.
//   - Endpoint divergence: detail Cancel = POST /invoices/{id}/cancel (vs the list page's
//     DELETE /invoices/{id}). AND detail Cancel fires with NO confirmation (immediate),
//     unlike the list's modal. The ABSENCE of confirmation is pinned.
//   - Blob downloads: PDF = GET /invoices/{id}/pdf (download invoice-{number}.pdf);
//     e-invoice = GET /invoices/{id}/einvoice?format=ubl (download {number}_einvoice.xml).
//   - Send (Draft only) refetches the invoice; action block gated on canWriteFinance.
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
const refresh = vi.fn();
const params = { id: "inv-1" };
// A78: STABLE router identity. The detail page's data-fetch effect lists `router` in its
// dependency array, so a fresh router object per render would loop infinitely.
const router = { push, replace, refresh };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => params,
  usePathname: () => "/finance/invoices/inv-1",
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

function makeInvoice(status = "Draft") {
  return {
    id: "inv-1",
    invoiceNumber: "R-100",
    date: "2026-01-01",
    dueDate: "2026-02-01",
    status,
    recipientType: "External",
    recipientName: "Alice Acme",
    recipientAddress: "Main St 1",
    subTotal: 100,
    taxRate: 0,
    taxAmount: 0,
    total: 100,
    totalNet: 100,
    totalTax: 0,
    totalGross: 100,
    items: [
      {
        id: "it1",
        description: "Service",
        quantity: 1,
        unitPrice: 100,
        amount: 100,
        taxCodeCode: null,
        taxCodeLabel: null,
        taxRate: 0,
        isGrossEntry: false,
        netAmount: 100,
        taxAmount: 0,
        grossAmount: 100,
      },
    ],
  };
}

let invoiceStatus = "Draft";

function routeGet(url: string) {
  if (url === "/api/v1/finance/invoices/inv-1") {
    return Promise.resolve({
      data: makeInvoice(invoiceStatus),
      error: null,
      status: 200,
    });
  }
  if (url.startsWith("/api/v1/finance/payments")) {
    return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
  }
  return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
}

beforeEach(() => {
  invoiceStatus = "Draft";
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();
  apiGet.mockImplementation((url: string) => routeGet(url));
  apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });
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

describe("invoices/[id] — read guard", () => {
  it("replaces to /finance and fires no GET when !canReadFinance", async () => {
    authState.canReadFinance = false;
    render(<Page />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/finance"));
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe("invoices/[id] — happy path + endpoints", () => {
  it("GETs the invoice and the invoiceId-scoped payments, renders the number", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "R-100" })).toBeInTheDocument()
    );
    expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/invoices/inv-1");
    expect(apiGet).toHaveBeenCalledWith(
      "/api/v1/finance/payments?invoiceId=inv-1"
    );
    expect(screen.getByText("Alice Acme")).toBeInTheDocument();
  });
});

describe("invoices/[id] — A99 load-error full-page card (no not-found sentinel)", () => {
  it("renders the generic error card when the invoice GET fails", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/invoices/inv-1") {
        return Promise.resolve({ data: null, error: "boom", status: 500 });
      }
      return Promise.resolve({ data: { items: [] }, error: null, status: 200 });
    });
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByText("errorLoadingInvoice")).toBeInTheDocument()
    );
    // No invoice header rendered.
    expect(screen.queryByText("R-100")).not.toBeInTheDocument();
  });
});

describe("invoices/[id] — write-gated action block", () => {
  it("shows the action block for canWriteFinance and hides it for read-only", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "R-100" })).toBeInTheDocument()
    );
    expect(screen.getByText("downloadPdf")).toBeInTheDocument();
    cleanup();

    authState.canWriteFinance = false;
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "R-100" })).toBeInTheDocument()
    );
    expect(screen.queryByText("downloadPdf")).not.toBeInTheDocument();
  });
});

describe("invoices/[id] — Cancel (POST /cancel divergence + immediate no-confirm)", () => {
  it("Cancel fires POST /invoices/{id}/cancel with NO confirmation modal (immediate)", async () => {
    invoiceStatus = "Sent";
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "R-100" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("cancel"));
    // Pin the divergence: POST /cancel (NOT DELETE /invoices/{id}).
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/invoices/inv-1/cancel",
        {}
      )
    );
    expect(apiDelete).not.toHaveBeenCalled();
    // Pin the ABSENCE of confirmation: only the load + the cancel POST happened directly.
    expect(apiPost).toHaveBeenCalledTimes(1);
  });
});

describe("invoices/[id] — Send (Draft only) refetches", () => {
  it("POSTs /send then re-GETs the invoice", async () => {
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "R-100" })).toBeInTheDocument()
    );
    const getsBefore = apiGet.mock.calls.filter(
      (c) => c[0] === "/api/v1/finance/invoices/inv-1"
    ).length;
    fireEvent.click(screen.getByText("send"));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        "/api/v1/finance/invoices/inv-1/send",
        {}
      )
    );
    await waitFor(() =>
      expect(
        apiGet.mock.calls.filter(
          (c) => c[0] === "/api/v1/finance/invoices/inv-1"
        ).length
      ).toBeGreaterThan(getsBefore)
    );
  });
});

describe("invoices/[id] — PDF blob download", () => {
  it("GETs the pdf endpoint and creates an object URL with download invoice-{number}.pdf", async () => {
    const blob = new Blob(["x"], { type: "application/pdf" });
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/invoices/inv-1/pdf") {
        return Promise.resolve({ data: blob, error: null, status: 200 });
      }
      return routeGet(url);
    });
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "R-100" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("downloadPdf"));
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith("/api/v1/finance/invoices/inv-1/pdf")
    );
    await waitFor(() =>
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob)
    );
  });
});

describe("invoices/[id] — e-invoice blob + 409 noProfileError (A99 branch)", () => {
  it("GETs the einvoice ubl endpoint and downloads {number}_einvoice.xml on success", async () => {
    invoiceStatus = "Sent";
    const blob = new Blob(["<xml/>"], { type: "application/xml" });
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/invoices/inv-1/einvoice?format=ubl") {
        return Promise.resolve({ data: blob, error: null, status: 200 });
      }
      return routeGet(url);
    });
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "R-100" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("downloadEInvoiceXml"));
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        "/api/v1/finance/invoices/inv-1/einvoice?format=ubl"
      )
    );
    await waitFor(() =>
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob)
    );
  });

  it("shows the noProfileError amber panel on a 409 'finance profile' error (no generic error)", async () => {
    invoiceStatus = "Sent";
    apiGet.mockImplementation((url: string) => {
      if (url === "/api/v1/finance/invoices/inv-1/einvoice?format=ubl") {
        return Promise.resolve({
          data: null,
          error: "No finance profile configured",
          status: 409,
        });
      }
      return routeGet(url);
    });
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "R-100" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("downloadEInvoiceXml"));
    await waitFor(() =>
      expect(screen.getByText("noFinanceProfile")).toBeInTheDocument()
    );
    expect(screen.getByText("goToSettings →")).toBeInTheDocument();
    // The generic error banner is NOT shown for this branch.
    expect(
      screen.queryByText("errorDownloadingEInvoice")
    ).not.toBeInTheDocument();
  });
});
